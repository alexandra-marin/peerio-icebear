import { observable, action, when } from 'mobx';
import socket from '../../network/socket';
import warnings from '../warnings';
import { getVolumeStore } from '../../helpers/di-volume-store';
import { cryptoUtil, publicCrypto } from '../../crypto';
import User from '../user/user';
import Keg from '../kegs/keg';

// this is not... the most amazing code reuse, but it works, and it's clear
class ChatHead extends Keg {
    constructor(db) {
        super('chat_head', 'chat_head', db);
    }
    chatName = '';

    deserializeKegPayload(payload) {
        this.chatName = payload.chatName || '';
    }
}

class ReceivedInvite {
    constructor(data) {
        Object.assign(this, data);
    }
    @observable declined = false;
}

class VolumeInviteStore {
    constructor() {
        socket.onceStarted(() => {
            socket.subscribe('volumeInvitesUpdate', this.update);
            socket.onAuthenticated(this.update);
        });
    }
    @observable.shallow received = [];
    @observable sent = observable.shallowMap();
    @observable left = observable.shallowMap();
    @observable rejected = observable.shallowMap();

    updating = false;
    updateAgain = false;

    /**
     * Active invite object { kegDbId, volumeName, username }
     */
    @observable activeInvite = null;

    /**
     * Activate invite by id
     */
    @action.bound
    activateInvite(kegDbId: string) {
        const invite = this.received.find(obj => {
            return obj.kegDbId === kegDbId;
        });

        if (!invite) return;

        this.activeInvite = invite;
    }

    /**
     * Deactivate current invite
     */
    @action.bound
    deactivateInvite() {
        this.activeInvite = null;
    }

    updateInvitees = () => {
        return socket.send('/auth/kegs/volume/invitees').then(
            action(res => {
                this.sent.clear();
                this.rejected.clear();
                res.forEach(item => {
                    // regular invites
                    let arr = this.sent.get(item.kegDbId);
                    if (!arr) {
                        this.sent.set(item.kegDbId, []);
                        arr = this.sent.get(item.kegDbId);
                    }
                    Object.keys(item.invitees).forEach(username => {
                        if (item.rejected[username]) return;
                        arr.push({
                            username,
                            timestamp: item.invitees[username]
                        });
                    });
                    arr.sort((i1, i2) => i1.username.localeCompare(i2.username));

                    const rejectedUsernames = Object.keys(item.rejected);
                    this.rejected.set(item.kegDbId, rejectedUsernames);

                    Promise.map(
                        rejectedUsernames,
                        username => this.revokeInvite(item.kegDbId, username, true),
                        { concurrency: 1 }
                    );
                });
            })
        );
    };

    updateInvites = () => {
        return socket.send('/auth/kegs/volume/invites').then(
            action(res => {
                const newReceivedInvites = res.map(i => {
                    const volumeName = this.decryptVolumeName(i);
                    return new ReceivedInvite({
                        username: i.admin,
                        kegDbId: i.volume,
                        timestamp: i.timestamp,
                        volumeName
                    });
                });
                this.received = newReceivedInvites;
            })
        );
    };

    updateLeftUsers = () => {
        return socket.send('/auth/kegs/volume/users-left').then(
            action(res => {
                this.left.clear();
                for (const kegDbId in res) {
                    const leavers = res[kegDbId];
                    if (!leavers || !leavers.length) continue;
                    this.left.set(
                        kegDbId,
                        leavers.map(l => {
                            return { username: l };
                        })
                    );
                    getVolumeStore()
                        .getVolumeWhenReady(kegDbId)
                        .then(volume => {
                            if (!volume.canIAdmin) return;
                            Promise.map(leavers, l => volume.removeParticipant(l, false), {
                                concurrency: 1
                            });
                        })
                        .catch(err => {
                            console.error(err);
                        });
                }
            })
        );
    };

    async decryptChannelName(data) {
        try {
            const { bootKeg, chatHeadKeg } = data;
            bootKeg.payload = JSON.parse(bootKeg.payload);
            const keyId = (chatHeadKeg.keyId || 0).toString();
            const publicKey = cryptoUtil.b64ToBytes(bootKeg.payload.publicKey);
            let encKegKey = bootKeg.payload.encryptedKeys[keyId].keys[User.current.username];
            encKegKey = cryptoUtil.b64ToBytes(encKegKey);

            const kegKey = publicCrypto.decrypt(
                encKegKey,
                publicKey,
                User.current.encryptionKeys.secretKey
            );
            const fakeDb = { id: data.volume };
            const chatHead = new ChatHead(fakeDb);
            chatHead.overrideKey = kegKey;
            await chatHead.loadFromKeg(chatHeadKeg);
            return chatHead.chatName;
        } catch (ex) {
            console.error(ex);
            return '';
        }
    }

    update = () => {
        if (this.updating) {
            this.updateAgain = true;
            return;
        }
        this.updateAgain = false;
        if (!socket.authenticated) return;
        this.updating = true;

        // this.updateInvitees()
        // .then(this.updateInvites)
        this.updateLeftUsers()
            .catch(err => {
                console.error('Error updating invite store', err);
            })
            .finally(() => {
                this.afterUpdate();
            });
    };

    afterUpdate() {
        this.updating = false;
        if (this.updateAgain === false) return;
        setTimeout(this.update);
    }

    acceptInvite(kegDbId) {
        return socket
            .send('/auth/kegs/volume/invite/accept', { kegDbId })
            .then(() => {
                return new Promise(resolve => {
                    when(
                        () => {
                            const volume = getVolumeStore().volumes.find(c => c.id === kegDbId);
                            if (!volume) return false;
                            return volume.metaLoaded;
                        },
                        () => {
                            getVolumeStore().volumeMap[kegDbId].sendJoinMessage();
                            getVolumeStore().activate(kegDbId);
                            resolve();
                        }
                    );
                });
            })
            .catch(err => {
                console.error('Failed to accept invite', kegDbId, err);
                warnings.add('error_acceptChannelInvite');
                return Promise.reject(err);
            });
    }

    rejectInvite(kegDbId) {
        const invite = this.received.find(i => i.kegDbId === kegDbId);
        if (!invite) {
            return Promise.reject(
                new Error(`Can not reject invite for ${kegDbId} because it is not found`)
            );
        }
        invite.declined = true;
        return Promise.delay(500).then(() =>
            socket.send('/auth/kegs/volume/invite/reject', { kegDbId }).catch(err => {
                console.error('Failed to reject invite', kegDbId, err);
                warnings.add('error_rejectChannelInvite');
                return Promise.reject(err);
            })
        );
    }

    revokeInvite(kegDbId, username, noWarning = false) {
        return getVolumeStore()
            .getVolumeWhenReady(kegDbId)
            .then(volume => {
                if (!volume.canIAdmin) return Promise.resolve();
                return volume.removeParticipant(username, false).catch(err => {
                    console.error(err);
                    if (!noWarning) {
                        warnings.add('error_revokeChannelInvite');
                    }
                });
            });
    }
}

export default new VolumeInviteStore();
