const { observable, action, when } = require('mobx');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const { getChatStore } = require('../../helpers/di-chat-store');
const { cryptoUtil, publicCrypto } = require('../../crypto');
const User = require('../user/user');
const Keg = require('../kegs/keg');
const { getUser } = require('../../helpers/di-current-user');

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
    @observable declined = false;
    constructor(data) {
        Object.assign(this, data);
    }
}

/**
 * Chat invites store. Contains lists of incoming and outgoing invites and operations on them.
 * @namespace
 * @public
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
     * @member {ObservableArray<{kegDbId: string, username: string, timestamp: number}>} received
     * @memberof ChatInviteStore
     * @instance
     * @public
     */
    @observable.shallow received = [];

    /**
     * List of channel invites admins of current channel have sent.
     * @member {Map<kegDbId: string, [{username: string, timestamp: number}]>} sent
     * @memberof ChatInviteStore
     * @instance
     * @public
     */
    @observable sent = observable.shallowMap();

    /**
     * List of users requested to leave channels. This is normally for internal icebear use.
     * Icebear will monitor this list and remove keys from boot keg for leavers
     * if current user is an admin of specific channel. Then icebear will remove an item from this list.
     * todo: the whole system smells a bit, maybe think of something better
     * @member {Map<{kegDbId: string, username: string}>} left
     * @memberof ChatInviteStore
     * @instance
     * @protected
     */
    @observable left = observable.shallowMap();

    /**
     * List of users who rejected invites and are pending to be removed from boot keg.
     * @member {Map<{kegDbId: string, username: string}>} rejected
     * @memberof ChatInviteStore
     * @instance
     * @protected
     */
    @observable rejected = observable.shallowMap();

    updating = false;
    updateAgain = false;
    initialInvitesProcessed = false;

    /**
     * Active invite object { kegDbId, channelName, username }
     */
    @observable activeInvite = null;

    /**
     * Activate invite by id
     * @param {string} kegDbId
     */
    @action.bound activateInvite(kegDbId) {
        const invite = this.received.find(obj => {
            return obj.kegDbId === kegDbId;
        });

        if (!invite) return;

        this.activeInvite = invite;
    }

    /**
     * Deactivate current invite
     */
    @action.bound deactivateInvite() {
        this.activeInvite = null;
    }

    /** @private */
    updateInvitees = () => {
        return socket.send('/auth/kegs/channel/invitees')
            .then(action(res => {
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
                        arr.push({ username, timestamp: item.invitees[username] });
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
            }));
    };

    /** @private */
    updateInvites = () => {
        return socket.send('/auth/kegs/channel/invites')
            .then(action(res => {
                const newReceivedInvites = res.map(i => {
                    const channelName = this.decryptChannelName(i);
                    const participants = this.getParticipants(i);
                    return new ReceivedInvite({
                        username: i.admin,
                        kegDbId: i.channel,
                        timestamp: i.timestamp,
                        participants,
                        channelName
                    });
                });
                if (this.initialInvitesProcessed) {
                    // Find new invites and notify about them.
                    newReceivedInvites.forEach(invite => {
                        for (let i = 0; i < this.received.length; i++) {
                            if (this.received[i].kegDbId === invite.kegDbId) {
                                return; // invite seen
                            }
                        }
                        // invite not seen, notify.
                        setTimeout(() => { getChatStore().onInvitedToChannel({ invite }); });
                    });
                }
                this.received = newReceivedInvites;
            }));
    };

    /** @private */
    updateLeftUsers = () => {
        return socket.send('/auth/kegs/channel/users-left')
            .then(action(res => {
                this.left.clear();
                for (const kegDbId in res) {
                    const leavers = res[kegDbId];
                    if (!leavers || !leavers.length) continue;
                    this.left.set(kegDbId, leavers.map(l => { return { username: l }; }));
                    getChatStore()
                        .getChatWhenReady(kegDbId)
                        .then(chat => {
                            if (!chat.canIAdmin) return;
                            Promise.map(leavers, l => chat.removeParticipant(l, false), { concurrency: 1 });
                        })
                        .catch(err => {
                            console.error(err);
                        });
                }
            }));
    };

    getParticipants(data) {
        const { bootKeg, chatHeadKeg } = data;
        const keyId = (chatHeadKeg.keyId || 0).toString();
        const participantsList = bootKeg.payload.encryptedKeys[keyId].keys;
        const usernames = Object.keys(participantsList);

        return usernames;
    }

    /**
     * @param {Object} data - invite objects
     * @returns {string}
     * @private
     */
    decryptChannelName(data) {
        try {
            const { bootKeg, chatHeadKeg } = data;
            bootKeg.payload = JSON.parse(bootKeg.payload);
            const keyId = (chatHeadKeg.keyId || 0).toString();
            const publicKey = cryptoUtil.b64ToBytes(bootKeg.payload.publicKey);
            let encKegKey = bootKeg.payload.encryptedKeys[keyId].keys[User.current.username];
            encKegKey = cryptoUtil.b64ToBytes(encKegKey);

            const kegKey = publicCrypto.decrypt(encKegKey, publicKey, User.current.encryptionKeys.secretKey);
            const fakeDb = { id: data.channel };
            const chatHead = new ChatHead(fakeDb);
            chatHead.overrideKey = kegKey;
            chatHead.loadFromKeg(chatHeadKeg);
            return chatHead.chatName;
        } catch (ex) {
            console.error(ex);
            return '';
        }
    }
    /**
     * Updates local data from server.
     * @function
     * @memberof ChatInviteStore
     * @private
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

    /**
     * @private
     */
    afterUpdate() {
        this.initialInvitesProcessed = true;
        this.updating = false;
        if (this.updateAgain === false) return;
        setTimeout(this.update);
    }

    /**
     * @param {string} kegDbId
     * @public
     */
    acceptInvite(kegDbId) {
        if (getUser().channelsLeft === 0) {
            warnings.add('error_acceptChannelInvite');
            return Promise.reject(new Error('Channel limit reached'));
        }
        return socket.send('/auth/kegs/channel/invite/accept', { kegDbId })
            .then(() => {
                return new Promise(resolve => {
                    when(() => {
                        const chat = getChatStore().chats.find(c => c.id === kegDbId);
                        if (!chat) return false;
                        return chat.metaLoaded;
                    }, () => {
                        getChatStore().chatMap[kegDbId].sendJoinMessage();
                        getChatStore().activate(kegDbId);
                        resolve();
                    });
                });
            }).catch(err => {
                console.error('Failed to accept invite', kegDbId, err);
                warnings.add('error_acceptChannelInvite');
                return Promise.reject(err);
            });
    }

    /**
     * @param {string} kegDbId
     * @public
     */
    rejectInvite(kegDbId) {
        const invite = this.received.find(i => i.kegDbId === kegDbId);
        if (!invite) {
            return Promise.reject(new Error(`Can not reject invite for ${kegDbId} because it is not found`));
        }
        invite.declined = true;
        return Promise.delay(500).then(() =>
            socket.send('/auth/kegs/channel/invite/reject', { kegDbId })
                .catch(err => {
                    console.error('Failed to reject invite', kegDbId, err);
                    warnings.add('error_rejectChannelInvite');
                    return Promise.reject(err);
                })
        );
    }

    /**
     * @param {string} kegDbId
     * @param {string} username
     * @public
     */
    revokeInvite(kegDbId, username, noWarning = false) {
        return getChatStore().getChatWhenReady(kegDbId).then(chat => {
            if (!chat.canIAdmin) return Promise.resolve();
            return chat.removeParticipant(username, false)
                .catch(err => {
                    console.error(err);
                    if (!noWarning) {
                        warnings.add('error_revokeChannelInvite');
                    }
                });
        });
    }
}

module.exports = new ChatInviteStore();
