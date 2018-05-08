// @ts-check

const { observable, action, computed, reaction, autorunAsync, isObservableArray, when, runInAction } = require('mobx');
const Chat = require('./chat');
const ChatStorePending = require('./chat-store.pending.js');
const socket = require('../../network/socket');
const tracker = require('../update-tracker');
const { EventEmitter } = require('eventemitter3');
const _ = require('lodash');
const { retryUntilSuccess } = require('../../helpers/retry');
const MyChats = require('../chats/my-chats');
const TinyDb = require('../../db/tiny-db');
const config = require('../../config');
const { asPromise } = require('../../helpers/prombservable');
const { getUser } = require('../../helpers/di-current-user');
const warnings = require('../warnings');
const { setChatStore } = require('../../helpers/di-chat-store');
const { getFileStore } = require('../../helpers/di-file-store');
const { cryptoUtil } = require('../../crypto');

// Used for typechecking
// eslint-disable-next-line no-unused-vars
const Contact = require('../contacts/contact');

/**
 * Chat store.
 * @namespace
 * @public
 */
class ChatStore {
    constructor() {
        this.pending = new ChatStorePending(this);

        reaction(() => this.activeChat, chat => {
            if (chat) chat.loadMessages();
        });

        autorunAsync(() => {
            this.sortChats();
        }, 500);
        socket.onceAuthenticated(async () => {
            this.unreadChatsAlwaysOnTop = !!(await TinyDb.user.getValue('pref_unreadChatsAlwaysOnTop'));
            autorunAsync(() => {
                TinyDb.user.setValue('pref_unreadChatsAlwaysOnTop', this.unreadChatsAlwaysOnTop);
            }, 2000);
            this.loadAllChats();
        });
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.channelDeleted, this.processChannelDeletedEvent);
        });
    }

    // todo: not sure this little event emitter experiment should live
    EVENT_TYPES = {
        messagesReceived: 'messagesReceived',
        invitedToChannel: 'invitedToChannel'
    };
    /**
     * Events emitter.
     * @member {EventEmitter}
     * @type {EventEmitter}
     * @public
     */
    events = new EventEmitter();

    /**
     * Working set of chats. Server might have more, but we display only these at any time.
     * @member {ObservableArray<Chat>} chats
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable.shallow chats = [];

    /**
     * @member {boolean} unreadChatsAlwaysOnTop
     * @type {boolean} unreadChatsAlwaysOnTop
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable unreadChatsAlwaysOnTop = false;

    /**
     * MyChats Keg
     * @member {MyChats} myChats
     * @type {MyChats} myChats
     * @protected
     */
    myChats;

    /**
     * To prevent duplicates
     * @member {{chatId:Chat}}
     * @type {{[chatId : string]: Chat}}
     * @private
     */
    chatMap = {};
    /**
     * True when chat list loading is in progress.
     * @member {boolean} loading
     * @type {boolean} loading
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable loading = false;

    /**
     * True when all chats has been updated after reconnect
     * @member {boolean} updatedAfterReconnect
     * @type {boolean} updatedAfterReconnect
     * @memberof ChatStore
     * @instance
     * @public
     */
    @computed get updatedAfterReconnect() {
        return this.chats.every(c => c.updatedAfterReconnect);
    }

    /**
     * currently selected/focused chat.
     * @member {Chat} activeChat
     * @type {Chat} activeChat
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable activeChat = null;
    /**
     * Chats set this flag and UI should use it to prevent user from spam-clicking the 'hide' button
     * @member {boolean} hidingChat
     * @type {boolean} hidingChat
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable hidingChat = false;
    /**
     * True when loadAllChats() was called and finished once already.
     * @member {boolean} loaded
     * @type {boolean} loaded
     * @memberof ChatStore
     * @instance
     * @public
     */
    @observable loaded = false;

    /**
     * Total unread messages in all chats.
     * @member {number} unreadMessages
     * @type {number} unreadMessages
     * @memberof ChatStore
     * @readonly
     * @instance
     * @public
     */
    @computed get unreadMessages() {
        return this.chats.reduce((acc, curr) => acc + curr.unreadCount, 0);
    }

    /**
     * Subset of ChatStore#chats, contains direct message chats and pending DMs
     * @member {Array<Chat>} directMessages
     * @type {Array<Chat>} directMessages
     * @memberof ChatStore
     * @readonly
     * @instance
     * @public
     */
    @computed get directMessages() {
        return this.chats.filter(chat => !chat.isChannel && chat.headLoaded);
    }

    /**
     * Subset of ChatStore#chats, contains only channel chats
     * @member {Array<Chat>} channels
     * @type {Array<Chat>} channels
     * @memberof ChatStore
     * @readonly
     * @instance
     * @public
     */
    @computed get channels() {
        return this.chats.filter(chat => chat.isChannel && chat.headLoaded);
    }

    /**
     * Does chat store has any channels or not.
     * @member {boolean} hasChannels
     * @type {boolean} hasChannels
     * @memberof ChatStore
     * @readonly
     * @instance
     * @public
     */
    @computed get hasChannels() {
        return !!this.channels.length;
    }


    /**
     * Does smart and efficient 'in-place' sorting of observable array.
     * Note that ObservableArray#sort creates copy of the array. This function sorts in place.
     * @protected
     */
    sortChats() {
        if (this.loading) return;
        console.log('Chat list sorting.');
        const array = this.chats;
        for (let i = 1; i < array.length; i++) {
            const item = array[i];
            let indexHole = i;
            while (
                indexHole > 0
                && ChatStore.compareChats(array[indexHole - 1], item, this.unreadChatsAlwaysOnTop) > 0
            ) {
                array[indexHole] = array[--indexHole];
            }
            array[indexHole] = item;
        }
    }

    /**
     * Chat comparison function. Takes into account favorite status of the chat, timestamp and user preferences.
     * @static
     * @param {Chat} a
     * @param {Chat} b
     * @param {boolean} unreadOnTop
     * @returns {number} -1, 0 or 1
     * @protected
     */
    static compareChats(a, b, unreadOnTop) {
        if (a.isChannel && !b.isChannel) {
            return -1;
        }
        if (!a.isChannel && b.isChannel) {
            return 1;
        }
        if (a.isChannel && b.isChannel) {
            return a.name.localeCompare(b.name);
        }
        if (a.isFavorite) {
            // favorite chats are sorted by name
            if (b.isFavorite) {
                return a.name.localeCompare(b.name);
            }
            // a is fav, b is not fav
            return -1;
        } else if (!b.isFavorite) {
            // if it is a pending DM
            if (a.isInvite) {
                if (b.isInvite) {
                    return a.name.localeCompare(b.name);
                }
                // a is pending dm, b is not
                return -1;
            } else if (b.isInvite) {
                // b is pending dm, a is not
                return 1;
            }
            // non favorite chats sort by a weird combination unread count and then by update time
            if (unreadOnTop) {
                // we want chats with unread count > 0 to always come first
                if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
            }
            // if both chats have unread message - then sort by update time
            const amsg = a.mostRecentMessage;
            const bmsg = b.mostRecentMessage;
            if (!amsg) {
                if (!bmsg) return 0;
                return 1;
            } else if (!bmsg) {
                return -1;
            }
            return amsg.timestamp > bmsg.timestamp ? -1 : 1;
        }
        // a is not fav, b is fav
        return 1;
    }

    processChannelDeletedEvent = data => {
        const chat = this.chatMap[data.kegDbId];
        if (!chat) return;
        if (!chat.deletedByMyself) {
            warnings.addSevere('title_kickedFromChannel', '', { name: chat.name });
        }
        this.unloadChat(chat);
        this.switchToFirstChat();
    };

    onNewMessages = _.throttle((props) => {
        this.events.emit(this.EVENT_TYPES.messagesReceived, props);
    }, 1000);

    onInvitedToChannel = (props) => {
        this.events.emit(this.EVENT_TYPES.invitedToChannel, props);
    };

    generateJitsiUrl() {
        const id = cryptoUtil.getRandomGlobalShortIdHex();
        return `https://meet.jit.si/${id}`;
    }

    /**
     * Adds chat to the list.
     * @function addChat
     * @param {string | Chat} chat - chat id or Chat instance
     * @public
     */
    addChat = (chat) => {
        if (!chat) throw new Error(`Invalid chat id. ${chat}`);
        let c;
        if (typeof chat === 'string') {
            if (chat === 'SELF' || this.chatMap[chat]) return;
            c = new Chat(chat, undefined, this, chat.startsWith('channel:'));
        } else {
            c = chat;
            if (this.chatMap[c.id]) {
                console.error('Trying to add a copy of an instance of a chat that already exists.', c.id);
                return;
            }
        }

        if (this.myChats.favorites.includes(c.id)) c.isFavorite = true;
        this.chatMap[c.id] = c;
        this.chats.push(c);
        c.added = true;
        // console.log('Added chat ', c.id);
        if (this.myChats.hidden.includes(c.id)) c.unhide();
        c.loadMetadata().then(() => c.loadMostRecentMessage())
            .then(() => this.pending.onChatAdded(c));
        if (this.loaded && !this.activeChat) this.activate(c.id);
    };

    // takes current fav/hidden lists and makes sure store.chats reflect it
    // at first login this class and chat list loader will call this function once each making sure data is applied
    @action.bound applyMyChatsData() {
        // resetting fav state for every chat
        this.chats.forEach(chat => { chat.isFavorite = false; });
        // marking favs as such
        this.myChats.favorites.forEach(id => {
            const favchat = this.chatMap[id];
            if (!favchat) {
                // fav chat isn't loaded, probably got favorited on another device
                this.addChat(id);
            } else {
                favchat.isFavorite = true;
            }
        });
        setTimeout(() => {
            // hiding all hidden chats
            this.myChats.hidden.forEach(id => {
                const chat = this.chatMap[id];
                if (chat) chat.hide();
            });
        }, 2000);
    }


    /**
     * Initial chats list loading, call once after login.
     *
     * Logic:
     * - load all favorite chats
     * - see if we have some limit left and load other unhidden chats
     * - see if digest contains some new chats that are not hidden
     *
     * ORDER OF THE STEPS IS IMPORTANT ON MANY LEVELS
     * @function loadAllChats
     * @returns {Promise}
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action async loadAllChats() {
        if (this.loaded || this.loading) return;
        this.loading = true;
        await asPromise(tracker, 'updatedAfterReconnect', true);
        // 1. Loading my_chats keg
        this.myChats = new MyChats();
        this.myChats.onUpdated = this.applyMyChatsData;
        // 2. loading favorite chats
        // gonna happen in applyMyChatsData when fav list is loaded
        await asPromise(this.myChats, 'loaded', true);
        // 3. checking how many more chats we can load
        const rest = config.chat.maxInitialChats - this.myChats.favorites.length;
        if (rest > 0) {
            // 4. loading the rest unhidden chats
            await retryUntilSuccess(() =>
                socket.send('/auth/kegs/user/dbs')
                    .then(action(list => {
                        let k = 0;
                        for (const id of list) {
                            if (id.startsWith('channel:')) {
                                this.addChat(id);
                                continue;
                            }
                            if (id === 'SELF' || this.myChats.hidden.includes(id)
                                || this.myChats.favorites.includes(id)) continue;
                            if (k++ >= rest) continue;
                            this.addChat(id);
                        }
                    })));
        }
        // 5. check if chats were created while we were loading chat list
        // unlikely, but possible
        runInAction(() => {
            Object.keys(tracker.digest).forEach(this.addChat);
        });
        // 6. subscribe to future chats that will be created
        // this should always happen right after adding chats from digest, synchronously,
        // so that there's no new chats that can slip away
        tracker.onKegDbAdded(this.addChat);

        // 7. waiting for most chats to load but up to a reasonable time
        await Promise.map(this.chats, chat => asPromise(chat, 'headLoaded', true))
            .timeout(5000)
            .catch(() => { /* well, the rest will trigger re-render */ })
            .then(() => {
                // not returning promise because don't want to wait
                getFileStore().loadAllFiles();
            });

        // 8. find out which chat to activate.
        const lastUsed = await TinyDb.user.getValue('lastUsedChat');
        if (lastUsed && this.chatMap[lastUsed]) this.activate(lastUsed);
        else if (this.chats.length) this.activate(this.chats[0].id);

        this.loading = false;
        this.loaded = true;
    }

    getSelflessParticipants(participants) {
        return participants.filter(p => !p.isMe);
    }

    /**
     * When starting new chat for a list of participants we need a way to check if it already is loaded without knowing
     * the chatId.
     * @param {Array<Contact>} participants
     * @returns {?Chat} if found
     * @private
     */
    findCachedChatWithParticipants(participants) {
        // validating participants
        if (!participants || !participants.length) {
            throw new Error('Can not start chat with no participants');
        }
        for (const p of participants) {
            if (p.loading || p.notFound) {
                throw new Error(`Invalid participant: ${p.username}, loading:${p.loading}, found:${!p.notFound}`);
            }
        }
        // we don't want our own user in participants, it's handled on the lowest level only.
        // generally ui should assume current user is participant to everything
        const filteredParticipants = this.getSelflessParticipants(participants);
        // maybe we already have this chat cached
        for (const c of this.directMessages) {
            if (c.hasSameParticipants(filteredParticipants)) return c;
        }
        return null;
    }

    /**
     * Sets activeChat to first chat in list
     * @protected
     */
    switchToFirstChat() {
        for (let i = 0; i < this.chats.length; i++) {
            const chat = this.chats[i];
            if (chat.leaving) continue;
            this.activate(chat.id);
            return;
        }
        this.deactivateCurrentChat();
    }

    /**
     * Starts new chat or loads existing one and
     * @function startChat
     * @param {Array<Contact>=} participants
     * @param {boolean=} isChannel
     * @param {string=} name
     * @param {string=} purpose - only for channels, not relevant for DMs
     * @returns {?Chat} - can return null in case of paywall
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action startChat(participants = [], isChannel = false, name, purpose) {
        const cached = isChannel ? null : this.findCachedChatWithParticipants(participants);
        if (cached) {
            this.activate(cached.id);
            return cached;
        }
        if (isChannel && getUser().channelsLeft === 0) {
            warnings.add('error_channelLimitReached');
            return null;
        }
        // we can't add participants before setting channel name because
        // server will trigger invites and send empty chat name to user
        const chat = new Chat(null, isChannel ? [] : this.getSelflessParticipants(participants), this, isChannel);
        runInAction(async () => {
            await chat.loadMetadata();
            this.addChat(chat);
            this.activate(chat.id);
            if (name) await chat.rename(name);
            if (purpose) await chat.changePurpose(purpose);
            if (isChannel) {
                chat.addParticipants(this.getSelflessParticipants(participants));
            }
        });
        return chat;
    }

    /**
     * Activates the chat.
     * @function activate
     * @param {string} id - chat id
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action activate(id) {
        const chat = this.chatMap[id];
        if (!chat) return;
        TinyDb.user.setValue('lastUsedChat', id);
        if (this.activeChat) {
            this.activeChat.active = false;
        }
        chat.active = true;
        this.activeChat = chat;
    }

    /**
     * Deactivates currently active chat.
     * @function deactivateCurrentChat
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action deactivateCurrentChat() {
        if (!this.activeChat) return;
        this.activeChat.active = false;
        this.activeChat = null;
    }

    /**
     * Can be used from file view.
     * @function startChatAndShareFiles
     * @param {Array<Contact>} participants
     * @param {File|Array<File>} fileOrFiles
     * @returns {Promise}
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action startChatAndShareFiles(participants, fileOrFiles) {
        const files = (Array.isArray(fileOrFiles) || isObservableArray(fileOrFiles)) ? fileOrFiles : [fileOrFiles];
        const chat = this.startChat(participants);
        if (!chat) return Promise.reject(new Error('Failed to create chat'));
        return chat.loadMetadata().then(() => {
            chat.shareFiles(files);
            this.activate(chat.id);
        });
    }

    /**
     * Removes chat from working set.
     * @function unloadChat
     * @param {Chat} chat
     * @memberof ChatStore
     * @instance
     * @public
     */
    @action unloadChat(chat) {
        if (chat.active) {
            this.deactivateCurrentChat();
        }
        chat.dispose();
        delete this.chatMap[chat.id];
        this.chats.remove(chat);
    }

    /**
     * Returns a promise that resolves with chat instance once that chat is added to chat store and loaded.
     * @param {string} id - chat id
     * @returns {Promise<Chat>}
     * @protected
     */
    getChatWhenReady(id) {
        return new Promise((resolve) => {
            when(
                () => {
                    const chat = this.chats.find(c => c.id === id);
                    return !!(chat && chat.metaLoaded);
                },
                () => resolve(this.chatMap[id])
            );
        });
    }
}
const store = new ChatStore();
setChatStore(store);
module.exports = store;
