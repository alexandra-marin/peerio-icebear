import { observable, action, when, IObservableArray } from 'mobx';
import socket from '../../network/socket';
import warnings from '../warnings';
import { getChatStore } from '../../helpers/di-chat-store';
import { cryptoUtil, publicCrypto } from '../../crypto';
import User from '../user/user';
import { getUser } from '../../helpers/di-current-user';
import ChatHead from './chat-head';

class ReceivedInvite {
    constructor(data) {
        Object.assign(this, data);
    }

    metaLoaded = true;
    @observable declined = false;
}

/**
 * Chat invites store. Contains lists of incoming and outgoing invites and operations on them.
 */
class ChatInviteStore {
    constructor() {
        socket.onceStarted(() => {
            socket.subscribe('channelInvitesUpdate', this.update);
            socket.onAuthenticated(this.update);
        });
    }
    /**
     * List of channel ids current user has been invited to.
     */
    @observable.shallow received = [] as IObservableArray<{kegDbId: string, username: string, timestamp: number};

    /**
     * List of channel invites admins of current channel have sent.
     * key - kegDbId
     */
    @observable sent = observable.shallowMap<[{username: string, timestamp: number}]>();

    /**
     * List of users requested to leave channels. This is normally for internal icebear use.
     * Icebear will monitor this list and remove keys from boot keg for leavers
     * if current user is an admin of specific channel. Then icebear will remove an item from this list.
     * key - kegDbId
     */
    @observable left = observable.shallowMap<[{username:string}]>();

    /**
     * List of users who rejected invites and are pending to be removed from boot keg.
     * key - kegDbId
     */
    @observable rejected = observable.shallowMap<string[]>();

    updating = false;
    updateAgain = false;
    initialInvitesProcessed = false;

    /**
     * Active invite object { kegDbId, channelName, username }
     */
    @observable activeInvite = null;

    /**
     * Activate invite by id
     */
    @action.bound
    activateInvite(kegDbId:string) {
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
        return socket.send('/auth/kegs/channel/invitees').then(
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
        return socket.send('/auth/kegs/channel/invites').then(
            action(async res => {
                const newReceivedInvites = [];
                for (const i of res) {
                    const chatHead = await this.getChatHead(i);
                    const participants = this.getParticipants(i);
                    const channelName = chatHead.chatName || '';
                    const data = {
                        username: i.admin,
                        kegDbId: i.channel,
                        timestamp: i.timestamp,
                        participants,
                        channelName
                    };

                    const isInSpace = !!chatHead.spaceId;
                    if (isInSpace) {
                        data.isInSpace = isInSpace;
                        data.chatHead = {
                            spaceId: chatHead.spaceId,
                            spaceName: chatHead.spaceName,
                            spaceDescription: chatHead.spaceDescription,
                            spaceRoomType: chatHead.spaceRoomType,
                            nameInSpace: chatHead.nameInSpace
                        };
                    }
                    newReceivedInvites.push(new ReceivedInvite(data));
                }
                if (this.initialInvitesProcessed) {
                    // Find new invites and notify about them.
                    newReceivedInvites.forEach(invite => {
                        for (let i = 0; i < this.received.length; i++) {
                            if (this.received[i].kegDbId === invite.kegDbId) {
                                return; // invite seen
                            }
                        }
                        // invite not seen, notify.
                        setTimeout(() => {
                            getChatStore().onInvitedToChannel({ invite });
                        });
                    });
                }
                this.received = newReceivedInvites;
            })
        );
    };

    updateLeftUsers = () => {
        return socket.send('/auth/kegs/channel/users-left').then(
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
                    getChatStore()
                        .getChatWhenReady(kegDbId)
                        .then(chat => {
                            if (!chat.canIAdmin) return;
                            Promise.map(leavers, l => chat.removeParticipant(l, false), {
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

    getParticipants(data) {
        const { bootKeg, chatHeadKeg } = data;
        const keyId = (chatHeadKeg.keyId || 0).toString();
        const participantsList = bootKeg.payload.encryptedKeys[keyId].keys;
        const usernames = Object.keys(participantsList);

        return usernames;
    }

    /**
     * @param data - invite objects
     */
    async getChatHead(data):Promise<ChatHead> {
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
            const fakeDb = { id: data.channel };
            const chatHead = new ChatHead(fakeDb);
            chatHead.overrideKey = kegKey;
            await chatHead.loadFromKeg(chatHeadKeg);

            return chatHead;
        } catch (ex) {
            console.error(ex);
            return '';
        }
    }

    /**
     * Updates local data from server.
     */
    update = () => {
        if (this.updating) {
            this.updateAgain = true;
            return;
        }
        this.updateAgain = false;
        if (!socket.authenticated) return;
        this.updating = true;

        this.updateInvitees()
            .then(this.updateInvites)
            .then(this.updateLeftUsers)
            .catch(err => {
                console.error('Error updating invite store', err);
            })
            .finally(() => {
                this.afterUpdate();
            });
    };

    afterUpdate() {
        this.initialInvitesProcessed = true;
        this.updating = false;
        if (this.updateAgain === false) return;
        setTimeout(this.update);
    }

    acceptInvite(kegDbId:string) {
        if (getUser().channelsLeft === 0) {
            warnings.add('error_acceptChannelInvite');
            return Promise.reject(new Error('Channel limit reached'));
        }
        return socket
            .send('/auth/kegs/channel/invite/accept', { kegDbId })
            .then(() => {
                return new Promise(resolve => {
                    when(
                        () => {
                            const chat = getChatStore().chats.find(c => c.id === kegDbId);
                            if (!chat) return false;
                            return chat.metaLoaded;
                        },
                        () => {
                            getChatStore().chatMap[kegDbId].sendJoinMessage();
                            getChatStore().activate(kegDbId);
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

    rejectInvite(kegDbId:string) {
        const invite = this.received.find(i => i.kegDbId === kegDbId);
        if (!invite) {
            return Promise.reject(
                new Error(`Can not reject invite for ${kegDbId} because it is not found`)
            );
        }
        invite.declined = true;
        return Promise.delay(500).then(() =>
            socket.send('/auth/kegs/channel/invite/reject', { kegDbId }).catch(err => {
                console.error('Failed to reject invite', kegDbId, err);
                warnings.add('error_rejectChannelInvite');
                return Promise.reject(err);
            })
        );
    }

    revokeInvite(kegDbId:string, username:string, noWarning = false) {
        return getChatStore()
            .getChatWhenReady(kegDbId)
            .then(chat => {
                if (!chat.canIAdmin) return Promise.resolve();
                return chat.removeParticipant(username, false).catch(err => {
                    console.error(err);
                    if (!noWarning) {
                        warnings.add('error_revokeChannelInvite');
                    }
                });
            });
    }
}

export default new ChatInviteStore();
