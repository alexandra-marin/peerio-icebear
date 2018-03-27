// @ts-check

const { observable, computed, action, when, reaction } = require('mobx');
const Message = require('./message');
const ChatKegDb = require('../kegs/chat-keg-db');
const User = require('../user/user');
const ChatFileHandler = require('./chat.file-handler');
const ChatMessageHandler = require('./chat.message-handler');
const ChatReceiptHandler = require('./chat.receipt-handler');
const config = require('../../config');
const TaskQueue = require('../../helpers/task-queue');
const clientApp = require('../client-app');
const ChatHead = require('./chat-head');
const contactStore = require('../contacts/contact-store');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const Contact = require('../contacts/contact');
const chatInviteStore = require('../chats/chat-invite-store');
const { asPromise } = require('../../helpers/prombservable');
const volumeStore = require('../volumes/volume-store');

// to assign when sending a message and don't have an id yet
let temporaryChatId = 0;
function getTemporaryChatId() {
    return `creating_chat:${temporaryChatId++}`;
}

// !! IN CASE YOUR EDITOR SHOWS THE STRING BELOW AS WHITESPACE !!
// Know that it's not a whitespace, it's unicode :thumb_up: emoji
const ACK_MSG = '👍';

/**
 * at least one of two arguments should be set
 * @param {string} id - chat id
 * @param {Array<Contact>} participants - chat participants, will be used to create chat or find it by participant list
 * @param {?bool} isChannel
 * @param {ChatStore} store
 * @public
 */
class Chat {
    constructor(id, participants = [], store, isChannel = false) {
        this.id = id;
        this.store = store;
        this.isChannel = isChannel;
        if (!id) this.tempId = getTemporaryChatId();
        this.db = new ChatKegDb(id, participants, isChannel);
        this._reactionsToDispose.push(
            reaction(
                () => this.active && clientApp.isFocused && clientApp.isInChatsView,
                shouldSendReceipt => {
                    if (shouldSendReceipt) this._sendReceipt();
                }
            ),
            reaction(
                () => clientApp.uiUserPrefs.externalContentEnabled,
                this.resetExternalContent
            ),
            reaction(
                () => clientApp.uiUserPrefs.externalContentJustForFavs,
                this.resetExternalContent
            )
        );
    }

    /**
     * Chat id
     * @member {?string} id
     * @memberof Chat
     * @instance
     * @public
     */
    @observable id = null;

    /**
     * Render these messages.
     * @member {ObservableArray<Message>} messages
     * @memberof Chat
     * @instance
     * @public
     */
    @observable.shallow messages = [];
    /**
     * Render these messages at the bottom of the chat, they don't have Id yet, you can use tempId.
     * @member {ObservableArray<Message>} limboMessages
     * @memberof Chat
     * @instance
     * @public
     */
    @observable.shallow limboMessages = [];

    // performance helper, to lookup messages by id and avoid duplicates
    _messageMap = {};

    compareContacts = (c1, c2) => {
        if (this.isAdmin(c1) && !this.isAdmin(c2)) return -1;
        if (!this.isAdmin(c1) && this.isAdmin(c2)) return 1;
        return c1.fullNameAndUsername.localeCompare(c2.fullNameAndUsername);
    }

    /**
     * All participants, including awaiting for invite accept or removal after leave.
     * Including current user.
     * @member {ObservableArray<Contact>} allParticipants
     * @memberof Chat
     * @instance
     * @public
     * @readonly
     */
    @computed get allParticipants() {
        if (!this.db.boot || !this.db.boot.participants) return [];
        return this.db.boot.participants.sort(this.compareContacts);
    }

    /**
     * Participants, including awaiting for invite accept or removal after leave.
     * Excluding current user.
     * @member {ObservableArray<Contact>} otherParticipants
     * @memberof Chat
     * @instance
     * @public
     * @readonly
     */
    @computed get otherParticipants() {
        return this.allParticipants.filter(p => p.username !== User.current.username);
    }

    /**
     * Room api. For DM will work too, but doesn't make sense, just use 'allParticipants'
     * Includes only currently joined room participants and current user.
     * Excludes users awaiting to accept invite or get removed after leave.
     * @member {Array<Contact>} allJoinedParticipants
     * @memberof Chat
     * @instance
     * @public
     * @readonly
     */
    @computed get allJoinedParticipants() {
        const filtered = this.allParticipants.slice();
        if (!this.isChannel) return filtered;

        const invited = chatInviteStore.sent.get(this.id) || [];
        const rejected = chatInviteStore.rejected.get(this.id) || [];
        const left = chatInviteStore.left.get(this.id) || [];

        const excluded = invited.concat(rejected).concat(left).map(p => p.username);

        return filtered.filter(p => !excluded.includes(p.username));
    }

    /**
     * If true - chat is not ready for anything yet.
     * @member {boolean} loadingMeta
     * @memberof Chat
     * @instance
     * @public
     */
    @observable loadingMeta = false;
    /**
     * @member {boolean} metaLoaded
     * @memberof Chat
     * @instance
     * @public
     */
    @observable metaLoaded = false;


    /**
     * This can happen when chat was just added or after reset()
     * @member {boolean} loadingInitialPage
     * @memberof Chat
     * @instance
     * @public
     */
    @observable loadingInitialPage = false;
    /**
     * Ready to render messages.
     * @member {boolean} initialPageLoaded
     * @memberof Chat
     * @instance
     * @public
     */
    @observable initialPageLoaded = false;
    /**
     * Ready to render most recent message contents in chat list.
     * @member {boolean} mostRecentMessageLoaded
     * @memberof Chat
     * @instance
     * @public
     */
    @observable mostRecentMessageLoaded = false;
    /**
     * @member {boolean} loadingTopPage
     * @memberof Chat
     * @instance
     * @public
     */
    @observable loadingTopPage = false;
    /**
     * @member {boolean} loadingBottomPage
     * @memberof Chat
     * @instance
     * @public
     */
    @observable loadingBottomPage = false;


    /**
     * can we go back in history from where we are? (load older messages)
     * @member {boolean} canGoUp
     * @memberof Chat
     * @instance
     * @public
     */
    @observable canGoUp = false;
    /**
     * can we go forward in history or we have the most recent data loaded
     * @member {boolean} canGoDown
     * @memberof Chat
     * @instance
     * @public
     */
    @observable canGoDown = false;

    /**
     * currently selected/focused in UI
     * @member {boolean} active
     * @memberof Chat
     * @instance
     * @public
     */
    @observable active = false;

    /**
     * Is this chat instance added to chat list already or not
     * @member {boolean} active
     * @memberof Chat
     * @instance
     * @public
     */
    @observable added = false;

    /**
     * @member {boolean} isFavorite
     * @memberof Chat
     * @instance
     * @public
     */
    @observable isFavorite = false;

    /**
     * Prevent spamming 'Favorite' button in GUI.
     * @member {boolean} changingFavState
     * @memberof Chat
     * @instance
     * @public
     */
    @observable changingFavState = false;

    /**
     * Will be set to `true` after leave() is called on the channel so UI can react until channel is actually removed.
     * @member {boolean} leaving
     * @memberof Chat
     * @instance
     * @public
     */
    @observable leaving = false;

    /**
     * Will be set to `true` after update logic is done on reconnect.
     * @member {boolean} updatedAfterReconnect
     * @memberof Chat
     * @instance
     * @public
     */
    @observable updatedAfterReconnect = true;

    /**
     * list of files being uploaded to this chat.
     * @member {ObservableArray<File>} uploadQueue
     * @memberof Chat
     * @instance
     * @public
     */
    @observable.shallow uploadQueue = [];
    /**
     * Unread message count in this chat.
     * @member {number} unreadCount
     * @memberof Chat
     * @instance
     * @public
     */
    @observable unreadCount = 0;
    /**
     * when user is not looking but chat is active and receiving updates,
     * chat briefly sets this value to the id of last seen message so client can render separator marker.
     * @member {string} newMessagesMarkerPos
     * @memberof Chat
     * @instance
     * @public
     */
    @observable newMessagesMarkerPos = '';
    /**
     * Indicates ongoing loading recent files list for this chat
     * @member {bool} loadingRecentFiles
     * @memberof Chat
     * @instance
     * @public
     */
    @observable loadingRecentFiles = false;
    @observable _recentFiles = null;
    /**
     * List of recent file ids for this chat.
     * @member {Array<string>} recentFiles
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get recentFiles() {
        if (this._recentFiles === null && !this.loadingRecentFiles) {
            this.loadingRecentFiles = true;
            if (this.metaLoaded) {
                this._fileHandler.getRecentFiles().then(res => {
                    this._recentFiles = res;
                    this.loadingRecentFiles = false;
                });
            }
        }
        return this._recentFiles || [];
    }

    /**
     * Chat head keg.
     * Observable, because `this.name` relies on it
     * @member {?ChatHead} chatHead
     * @memberof Chat
     * @instance
     * @public
     */
    @observable.ref chatHead;
    _messageHandler = null;
    _receiptHandler = null;
    _fileHandler = null;
    _headHandler = null;

    _addMessageQueue = new TaskQueue(1, config.chat.decryptQueueThrottle || 0);

    _reactionsToDispose = [];
    /**
     * @member {boolean} isReadOnly
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get isReadOnly() {
        if (this.isChannel) return false;
        return this.otherParticipants.length > 0
            && this.otherParticipants.filter(p => p.isDeleted).length === this.otherParticipants.length;
    }

    /**
     * Includes current user.
     * @member {Array<string>} participantUsernames
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get participantUsernames() {
        return this.allParticipants.map(p => p.username);
    }

    /**
     * @member {string} name
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get name() {
        if (this.isChannel && this.chatHead && this.chatHead.chatName) return this.chatHead.chatName;
        return this.otherParticipants.length === 0
            ? (User.current.fullName || User.current.username)
            : this.otherParticipants.map(p => p.fullName || p.username).join(', ');
    }

    /**
     * @member {string} purpose
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get purpose() {
        return this.chatHead && this.chatHead.purpose || '';
    }

    /**
     * @member {string} headLoaded
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get headLoaded() {
        return !!(this.chatHead && this.chatHead.loaded);
    }

    /**
     * User should not be able to send multiple ack messages in a row. We don't limit it on SDK level, but GUIs should.
     * @member {boolean} canSendAck
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get canSendAck() {
        if (this.limboMessages.length) {
            for (let i = 0; i < this.limboMessages.length; i++) {
                if (this.limboMessages[i].text === ACK_MSG) return false;
            }
        }
        if (!this.initialPageLoaded) return false;
        if (this.canGoDown) return true;
        if (!this.messages.length) return true;
        const lastmsg = this.messages[this.messages.length - 1];
        if (lastmsg.sender.username !== User.current.username) return true;
        if (lastmsg.text === ACK_MSG) return false;
        return true;
    }

    /**
     * User should not be able to send multiple video call messages in a row. Similar setup to ack throttling.
     * @member {boolean} canSendJitsi
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get canSendJitsi() {
        if (this.limboMessages.length) {
            for (let i = 0; i < this.limboMessages.length; i++) {
                if (this.limboMessages[i].systemData && this.limboMessages[i].systemData.action === 'videoCall') {
                    return false;
                }
            }
        }
        if (!this.initialPageLoaded) return false;
        if (this.canGoDown) return true;
        if (!this.messages.length) return true;
        const lastmsg = this.messages[this.messages.length - 1];
        if (lastmsg.sender.username !== User.current.username) return true;
        if (lastmsg.systemData && lastmsg.systemData.action === 'videoCall') return false;
        return true;
    }


    /**
     * Don't render message marker if this is false.
     * @member {boolean} showNewMessagesMarker
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get showNewMessagesMarker() {
        if (!this.newMessagesMarkerPos) return false;
        for (let i = this.messages.length - 1; i >= 0 && this.messages[i].id !== this.newMessagesMarkerPos; i--) {
            if (this.messages[i].sender.username !== User.current.username) return true;
        }
        return false;
    }

    /**
     * True if current user is an admin of this chat.
     * @member {boolean} canIAdmin
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get canIAdmin() {
        if (!this.isChannel) return true;
        if (!this.db.boot || !this.db.boot.admins.includes(contactStore.currentUser)) {
            return false;
        }
        return true;
    }

    /**
     * True if current user can leave the channel. (Last admin usually can't)
     * @member {boolean} canILeave
     * @memberof Chat
     * @instance
     * @public
     */
    @computed get canILeave() {
        if (!this.isChannel) return false;
        if (!this.canIAdmin) return true;
        return this.db.boot.admins.length > 1;
    }


    /**
     * @member {?Message} mostRecentMessage
     * @memberof Chat
     * @instance
     * @public
     */
    @observable mostRecentMessage;

    _metaPromise = null;
    /**
     * @returns {Promise}
     * @private
     */
    loadMetadata() {
        if (this.metaLoaded || this.loadingMeta) return this._metaPromise;
        this.loadingMeta = true;
        // retry is handled inside loadMeta()
        this._metaPromise = this.db.loadMeta()
            .then(action(justCreated => { // eslint-disable-line
                if (this.db.dbIsBroken) {
                    const errmsg = `Detected broken database. id ${this.db.id}`;
                    console.error(errmsg);
                    throw new Error(errmsg);
                }
                this.id = this.db.id;
                this._messageHandler = new ChatMessageHandler(this);
                this._fileHandler = new ChatFileHandler(this);
                this._receiptHandler = new ChatReceiptHandler(this);
                this.chatHead = new ChatHead(this.db);
                this.loadingMeta = false;
                this.metaLoaded = true;
                if (justCreated) {
                    const m = new Message(this.db);
                    m.setChatCreationFact();
                    return this._sendMessage(m);
                }
                setTimeout(() => this._messageHandler.onMessageDigestUpdate(), 2000);
            }));
        return this._metaPromise;
    }

    /**
     * Adds messages to current message list.
     * @param {Array<Object|Message>} kegs - list of messages to add
     * @param {boolean} [prepend=false] - add message to top of bottom
     * @function addMessages
     * @memberof Chat
     * @instance
     * @protected
     */
    @action addMessages(kegs, prepend = false) {
        if (!kegs || !kegs.length) return Promise.resolve();
        return new Promise((resolve) => {
            // we need this because we don't want to add messages one by one causing too many renders
            const accumulator = [];
            for (let i = 0; i < kegs.length; i++) {
                this._addMessageQueue.addTask(this._parseMessageKeg, this, [kegs[i], accumulator]);
            }
            this._addMessageQueue.addTask(this._finishAddMessages, this, [accumulator, prepend, kegs], resolve);
        });
    }

    // decrypting a bunch of kegs in one call is tough on mobile, so we do it asynchronously one by one
    _parseMessageKeg(keg, accumulator) {
        const msg = new Message(this.db);
        // no payload for some reason. probably because of connection break after keg creation
        if (!msg.loadFromKeg(keg) || msg.isEmpty) {
            console.debug('empty message keg', keg);
            return;
        }
        msg.parseExternalContent();
        accumulator.push(msg);
    }

    /**
     * Alert UI hooks of new messages/mentions.
     * @param {number} freshBatchMentionCount -- # of new/freshly loaded messages
     * @param {number} freshBatchMessageCount -- # of new/freshly loaded mentions
     * @param {number} lastMentionId -- id of last mention message, if exists
     * @private
     */
    onNewMessageLoad(freshBatchMentionCount, freshBatchMessageCount, lastMentionId) {
        // fresh batch could mean app/page load rather than unreads,
        // but we don't care about unread count if there aren't *new* unreads
        if (this.unreadCount && freshBatchMessageCount) {
            const lastMessageText = lastMentionId ?
                this._messageMap[lastMentionId].text : this.messages[this.messages.length - 1].text;
            this.store.onNewMessages({
                freshBatchMentionCount,
                lastMessageText,
                unreadCount: this.unreadCount,
                chat: this
            });
        }
    }

    _reTriggerPaging(prepend, kegs) {
        const ids = kegs.map(k => k.kegId);
        const startPoint = prepend ? Math.min(...ids) : Math.max(...ids);
        // protection against infinite loop in result of weird data
        if (!startPoint) return;
        setTimeout(() => this._messageHandler.getPage(prepend, startPoint.toString()));
    }

    // all kegs are decrypted and parsed, now we just push them to the observable array
    @action _finishAddMessages(accumulator, prepend, kegs) {
        let newMessageCount = 0;
        let newMentionCount = 0;
        let lastMentionId;
        if (!accumulator.length) {
            // this was en entire page of empty/deleted messages
            this._reTriggerPaging(prepend, kegs);
        }
        let addedCount = 0;
        for (let i = 0; i < accumulator.length; i++) {
            const msg = accumulator[i];
            // deleted message case
            if (msg.deleted) {
                delete this._messageMap[i];
                this.messages.remove(msg);
                continue;
            }
            // todo: maybe compare collection versions? Although sending message's collection version is not confirmed
            // changed message case
            const existing = this._messageMap[msg.id];
            if (existing) {
                this.messages.remove(existing);
            } else {
                // track number of new messages & mentions in 'batch'
                newMessageCount += 1;
                if (msg.isMention) {
                    newMentionCount += 1;
                    lastMentionId = msg.id;
                }
            }
            // new message case
            this._messageMap[msg.id] = msg;
            this.messages.push(msg);
            addedCount++;
        }
        if (!addedCount) {
            // this was en entire page of empty/deleted messages
            this._reTriggerPaging(prepend, kegs);
        }
        this.onNewMessageLoad(newMentionCount, newMessageCount, lastMentionId);
        if (!this.canGoDown && this.initialPageLoaded) this.detectFileAttachments(accumulator);
        // sort
        this.sortMessages();
        if (!prepend) {
            // updating most recent message
            for (let i = this.messages.length - 1; i >= 0; i--) {
                const msg = this.messages[i];
                if (!this.mostRecentMessage || +this.mostRecentMessage.id < +msg.id) {
                    this.mostRecentMessage = msg;
                }
                break;
            }
        }

        const excess = this.messages.length - config.chat.maxLoadedMessages;
        if (excess > 0) {
            if (prepend) {
                for (let i = this.messages.length - excess; i < this.messages.length; i++) {
                    delete this._messageMap[this.messages[i].id];
                }
                this.messages.splice(-excess);
                this.canGoDown = true;
            } else {
                for (let i = 0; i < excess; i++) {
                    delete this._messageMap[this.messages[i].id];
                }
                this.messages.splice(0, excess);
                this.canGoUp = true;
            }
        }

        this._detectFirstOfTheDayFlag();
        this._detectGrouping();
        this._detectLimboGrouping();
        if (!prepend) this._sendReceipt();// no sense in sending receipts when paging back
        this._receiptHandler.applyReceipts();
    }

    /**
     * Sorts messages in-place as opposed to ObservableArray#sort that returns a copy of array.
     * We use insertion sorting because it's optimal for our mostly always sorted small array.
     * @protected
     */
    sortMessages() {
        const array = this.messages;
        for (let i = 1; i < array.length; i++) {
            const item = array[i];
            let indexHole = i;
            while (indexHole > 0 && Chat.compareMessages(array[indexHole - 1], item) > 0) {
                array[indexHole] = array[--indexHole];
            }
            array[indexHole] = item;
        }
    }

    static compareMessages(a, b) {
        if (+a.id > +b.id) {
            return 1;
        }
        // in our case we only care if return value is 1 or not. So we skip value 0
        return -1;
    }

    /**
     * @function _sendMessage
     * @param {Message} m
     * @returns {Promise}
     * @private
     * @memberof Chat
     */
    _sendMessage(m) {
        if (this.canGoDown) this.reset();
        // send() will fill message with data required for rendering
        const promise = m.send();
        this.limboMessages.push(m);
        this._detectLimboGrouping();
        when(() => m.version > 1, action(() => {
            this.limboMessages.remove(m);
            m.tempId = null;
            // unless user already scrolled too high up, we add the message
            if (!this.canGoDown) {
                this._finishAddMessages([m], false);
            } else {
                this._detectLimboGrouping();
            }
        }));
        return promise;
    }

    /**
     * Create a new Message keg attached to this chat with the given
     * plaintext (and optional files) and send it to the server.
     * @function sendMessage
     * @param {string} text
     * @param {Array<string>} [files] an array of file ids.
     * @returns {Promise}
     * @memberof Chat
     */
    @action sendMessage(text, files) {
        const m = new Message(this.db);
        m.files = files;
        m.text = text;
        return this._sendMessage(m);
    }

    /**
     * Create a new Message keg attached to this chat with the given
     * plaintext (and optional files) and send it to the server.
     * @function sendMessage
     * @param {Object} richText A ProseMirror document tree, as JSON
     * @param {string} legacyText The rendered HTML of the rich text, for back-compat with older clients
     * @param {Array<string>} [files] An array of file ids
     * @returns {Promise}
     * @memberof Chat
     */
    @action sendRichTextMessage(richText, legacyText, files) {
        const m = new Message(this.db);
        m.files = files;
        m.richText = richText;
        m.text = legacyText;
        return this._sendMessage(m);
    }

    /**
     * todo: this is temporary, for messages that failed to send.
     * When we have message delete - it should be unified process.
     * @function removeMessage
     * @param {Message} message
     * @memberof Chat
     * @instance
     * @public
     */
    @action removeMessage(message) {
        this.limboMessages.remove(message);
        this.messages.remove(message);
        delete this._messageMap[message.id];
    }
    /**
     * @returns {Promise}
     * @public
     */
    sendAck() {
        return this.sendMessage(ACK_MSG);
    }

    /**
     * Checks if this chat's participants are the same with ones that are passed
     * @param participants
     * @returns boolean
     * @protected
     */
    hasSameParticipants(participants) {
        if (this.otherParticipants.length !== participants.length) return false;

        for (const p of participants) {
            if (!this.otherParticipants.includes(p)) return false;
        }
        return true;
    }

    /**
     * Note that file will not be shared if session ends, but it will be uploaded because of upload resume logic.
     * @param {string} path
     * @param {string} [name]
     * @param {boolean} [deleteAfterUpload=false]
     * @param {string} [message=null]
     * @returns {Promise}
     * @public
     */
    uploadAndShareFile(path, name, deleteAfterUpload = false, beforeShareCallback = null, message = null) {
        return this._fileHandler.uploadAndShare(path, name, deleteAfterUpload, beforeShareCallback, message);
    }

    /**
     * @param {Array<File>} files
     * @returns {Promise}
     * @public
     */
    shareFiles(files) {
        return this._fileHandler.share(files);
    }
    unshareFile(file) {
        return this._fileHandler.unshare(file);
    }

    shareFolders(folders) {
        folders.forEach(folder => this.uploadQueue.push(folder));
        let promise = Promise.resolve();
        folders.forEach(folder => {
            promise = promise.then(async () => {
                // retry and error handling
                // is done in store implementations
                try {
                    await volumeStore.convertFolder(folder);
                    await this.sendSharedFolder(folder);
                } catch (e) {
                    console.error(e);
                }
                this.uploadQueue.remove(folder);
            });
        });
        return promise;
    }

    async shareFilesAndFolders(filesAndFolders) {
        const files = filesAndFolders.filter(f => !f.isFolder);
        const folders = filesAndFolders.filter(f => f.isFolder);
        if (files.length) {
            await this.shareFiles(files);
        }
        if (folders.length) {
            await this.shareFolders(folders);
        }
    }

    /**
     * @returns {Promise}
     * @protected
     */
    loadMostRecentMessage() {
        return this._messageHandler.loadMostRecentMessage();
    }

    /**
     * @returns {Promise}
     * @protected
     */
    async loadMessages() {
        if (!this.metaLoaded) await this.loadMetadata();
        this._messageHandler.getInitialPage()
            .then(() => this._messageHandler.onMessageDigestUpdate());
    }

    /**
     * @public
     */
    loadPreviousPage() {
        if (!this.canGoUp) return;
        this._messageHandler.getPage(true);
    }

    /**
     * @public
     */
    loadNextPage() {
        if (!this.canGoDown) return;
        this._messageHandler.getPage(false);
    }

    /**
     * @param {string} name - pass empty string to remove chat name
     * @public
     */
    rename(name) {
        let validated = name || '';
        validated = validated.trim().substr(0, config.chat.maxChatNameLength);
        if (this.chatHead.chatName === validated || (!this.chatHead.chatName && !validated)) {
            return Promise.resolve(); // nothing to rename
        }
        return this.chatHead.save(() => {
            this.chatHead.chatName = validated;
        }, null, 'error_chatRename')
            .then(() => {
                const m = new Message(this.db);
                m.setRenameFact(validated);
                return this._sendMessage(m);
            });
    }

    /**
     * @param {string} purpose - pass empty string to remove chat purpose
     * @public
     */
    changePurpose(purpose) {
        let validated = purpose || '';
        validated = validated.trim().substr(0, config.chat.maxChatPurposeLength);
        if (this.chatHead.purpose === validated || (!this.chatHead.purpose && !validated)) {
            return Promise.resolve(); // nothing to change
        }
        return this.chatHead.save(() => {
            this.chatHead.purpose = validated;
        }, null, 'error_chatPurposeChange')
            .then(() => {
                const m = new Message(this.db);
                m.setPurposeChangeFact(validated);
                return this._sendMessage(m);
            });
    }

    /**
     * @function toggleFavoriteState
     * @public
     */
    toggleFavoriteState = () => {
        this.changingFavState = true;
        const { myChats } = this.store;
        const newVal = !this.isFavorite;
        myChats.save(
            () => {
                newVal ? myChats.addFavorite(this.id) : myChats.removeFavorite(this.id);
            },
            () => {
                newVal ? myChats.removeFavorite(this.id) : myChats.addFavorite(this.id);
            }
        ).then(() => { this.isFavorite = newVal; })
            .finally(() => { this.changingFavState = false; });
    }

    /**
     * @function hide
     * @public
     */
    hide = () => {
        this.store.unloadChat(this);
        this.store.hidingChat = true;
        return this.store.myChats.save(() => {
            this.store.myChats.addHidden(this.id);
        }).finally(() => { this.store.hidingChat = false; });
    };

    /**
     * @function unhide
     * @public
     */
    unhide = () => {
        return this.store.myChats.save(() => {
            this.store.myChats.removeHidden(this.id);
        });
    };

    /**
     * Reloads most recent page of the chat like it was just added.
     * @public
     */
    reset() {
        this.loadingInitialPage = false;
        this.initialPageLoaded = false;
        this.loadingTopPage = false;
        this.loadingBottomPage = false;
        this.canGoUp = false;
        this.canGoDown = false;
        this._messageMap = {};
        this.messages.clear();
        this._cancelTopPageLoad = false;
        this._cancelBottomPageLoad = false;
        this.updatedAfterReconnect = true;
        this._recentFiles = null;
        this.loadMessages();
    }

    /**
     * Detects and sets firstOfTheDay flag for all loaded messages
     * @private
     */
    _detectFirstOfTheDayFlag() {
        if (!this.messages.length) return;
        this.messages[0].firstOfTheDay = true;

        for (let i = 1; i < this.messages.length; i++) {
            const current = this.messages[i];
            if (this.messages[i - 1].dayFingerprint !== current.dayFingerprint) {
                current.firstOfTheDay = true;
            } else {
                current.firstOfTheDay = false;
            }
        }
    }

    _detectGrouping() {
        if (!this.messages.length) return;
        this.messages[0].groupWithPrevious = false;

        for (let i = 1; i < this.messages.length; i++) {
            const current = this.messages[i];
            const prev = this.messages[i - 1];
            if (prev.sender.username === current.sender.username
                && prev.dayFingerprint === current.dayFingerprint
                && (current.timestamp - prev.timestamp) < 600000) { // 10 minutes
                current.groupWithPrevious = true;
            } else {
                current.groupWithPrevious = false;
            }
        }
    }

    _detectLimboGrouping() {
        if (!this.limboMessages.length) return;
        const prev = this.messages.length ? this.messages[this.messages.length - 1] : null;
        const current = this.limboMessages[0];
        current.groupWithPrevious = !!(prev && prev.sender.username === current.sender.username);
        for (let i = 1; i < this.limboMessages.length; i++) {
            this.limboMessages[i].groupWithPrevious = true;
        }
    }

    _sendReceipt() {
        // messages are sorted at this point ;)
        if (!this.messages.length) return;
        if (!clientApp.isFocused || !clientApp.isInChatsView || !this.active) return;

        this._receiptHandler.sendReceipt(+this.messages[this.messages.length - 1].id);
    }

    /**
     * Deletes the channel.
     * @returns {Promise}
     * @public
     */
    delete() {
        if (!this.isChannel) return Promise.reject(new Error('Can not delete DM chat.'));
        // this is an ugly-ish flag to prevent chat store from creating a warning about user being kicked from channel
        this.deletedByMyself = true;
        console.log(`Deleting channel ${this.id}.`);
        return socket.send('/auth/kegs/channel/delete', { kegDbId: this.id })
            .then(() => {
                console.log(`Channel ${this.id} has been deleted.`);
                warnings.add('title_channelDeleted');
            })
            .catch(err => {
                console.error('Failed to delete channel', err);
                this.deletedByMyself = false;
                warnings.add('error_channelDelete');
                return Promise.reject(err);
            });
    }

    /**
     * Adds participants to a channel.
     * @param {Array<string|Contact>} participants - mix of usernames and Contact objects.
     *                                               Note that this function will ensure contacts are loaded
     *                                               before proceeding. So if there are some invalid
     *                                               contacts - entire batch will fail.
     * @returns {Promise}
     * @public
     */
    addParticipants(participants) {
        if (!participants || !participants.length) return Promise.resolve();
        if (!this.isChannel) return Promise.reject(new Error('Can not add participants to a DM chat'));
        const contacts = participants.map(p => (typeof p === 'string' ? contactStore.getContactAndSave(p) : p));
        return Contact.ensureAllLoaded(contacts).then(() => {
            const { boot } = this.db;
            return boot.save(
                () => {
                    contacts.forEach(c => boot.addParticipant(c));
                    return true;
                },
                () => {
                    contacts.forEach(c => boot.removeParticipant(c));
                },
                'error_addParticipant'
            );
        })
            .then(() => {
                const names = contacts.map(c => c.username);
                if (!names.length) return;
                const m = new Message(this.db);
                m.setChannelInviteFact(names);
                this._sendMessage(m);
            });
    }

    /**
     * Assigns admin role to a contact.
     * @param {Contact} contact
     * @returns {Promise}
     * @public
     */
    promoteToAdmin(contact) {
        if (!this.otherParticipants.includes(contact)) {
            return Promise.reject(new Error('Attempt to promote user who is not a participant'));
        }
        if (this.db.admins.includes(contact)) {
            return Promise.reject(new Error('Attempt to promote user who is already an admin.'));
        }
        const { boot } = this.db;
        return boot.save(
            () => {
                boot.assignRole(contact, 'admin');
                return true;
            },
            () => {
                boot.unassignRole(contact, 'admin');
            },
            'error_promoteToAdmin'
        ).then(() => {
            const m = new Message(this.db);
            m.setRoleAssignFact(contact.username, 'admin');
            this._sendMessage(m);
        });
    }

    /**
     * Unassigns admin role from a contact.
     * @param {Contact} contact
     * @returns {Promise}
     * @public
     */
    demoteAdmin(contact) {
        if (!this.otherParticipants.includes(contact)) {
            return Promise.reject(new Error('Attempt to demote user who is not a participant'));
        }
        if (!this.db.admins.includes(contact)) {
            return Promise.reject(new Error('Attempt to demote user who is not an admin.'));
        }

        const { boot } = this.db;
        return boot.save(
            () => {
                boot.unassignRole(contact, 'admin');
                return true;
            },
            () => {
                boot.assignRole(contact, 'admin');
            },
            'error_demoteAdmin'
        ).then(() => {
            const m = new Message(this.db);
            m.setRoleUnassignFact(contact.username, 'admin');
            this._sendMessage(m);
        });
    }

    /**
     * Checks if a contact has admin rights to this chat.
     * @param {Contact} contact
     * @returns {boolean}
     * @public
     */
    isAdmin(contact) {
        return this.db.admins.includes(contact);
    }

    /**
     * Removes participant from the channel.
     * @param {string | Contact} participant
     * @param {boolean} isUserKick - this function is called in case admin kicks the user and in case user left and
     *                                admin needs to remove their keys. Method wants to know which case is it.
     * @returns {Promise}
     * @public
     */
    removeParticipant(participant, isUserKick = true) {
        let contact = participant;
        if (typeof contact === 'string') {
            // we don't really care if it's loaded or not, we just need Contact instance
            contact = contactStore.getContact(contact);
        }
        const { boot } = this.db;
        const wasAdmin = boot.admins.includes(contact);

        return contact.ensureLoaded()
            .then(() => {
                return boot.save(
                    () => {
                        if (wasAdmin) boot.unassignRole(contact, 'admin');
                        boot.removeParticipant(contact);
                        return true;
                    },
                    () => {
                        boot.addParticipant(contact);
                        if (wasAdmin) boot.assignRole(contact, 'admin');
                    },
                    'error_removeParticipant'
                );
            })
            .then(() => {
                if (!isUserKick) return;
                const m = new Message(this.db);
                m.setUserKickFact(contact.username);
                this._sendMessage(m);
            });
    }

    /**
     * Remove myself from this channel.
     * @public
     */
    leave() {
        this.leaving = true;
        const m = new Message(this.db);
        m.setChannelLeaveFact();
        return this._sendMessage(m)
            .then(() => socket.send('/auth/kegs/channel/leave', { kegDbId: this.id }))
            .tapCatch(err => {
                console.error('Failed to leave channel.', this.id, err);
                warnings.add('error_channelLeave');
                this.leaving = false;
            })
            .then(() => {
                this.store.switchToFirstChat();
            });
    }
    /**
     * Sends '{Current user} joined chat' system message to the chat.
     * @protected
     */
    sendJoinMessage() {
        const m = new Message(this.db);
        m.setChannelJoinFact();
        this._sendMessage(m);
    }

    /**
    * Sends jitsi link and message to the chat.
    */
    createVideoCall(link) {
        const m = new Message(this.db);
        m.sendVideoLink(link);
        this._sendMessage(m);
    }

    /**
    * TODO: replace with the real thing
    */
    sendSharedFolder(folder) {
        const m = new Message(this.db);
        m.sendSharedFolder(folder);
        return this._sendMessage(m);
    }


    /**
     * Checks if there are any file attachments in new message batch and adds them to _recentFiles if needed.
     * @private
     */
    @action detectFileAttachments(messages) {
        if (!this._recentFiles) {
            this._recentFiles = [];
        }
        for (let i = 0; i < messages.length; i++) {
            const { files } = messages[i];
            if (!files || !files.length) continue;
            for (let j = 0; j < files.length; j++) {
                if (!this._recentFiles.includes(files[j])) this._recentFiles.unshift(files[j]);
            }
        }
        if (this._recentFiles.length > config.chat.recentFilesDisplayLimit) {
            this._recentFiles.length = config.chat.recentFilesDisplayLimit;
        }
    }

    resetExternalContent = () => {
        if (this.resetScheduled) return;
        this.resetScheduled = true;
        when(() => this.active && clientApp.isInChatsView, this._doResetExternalContent);
    }

    @action.bound _doResetExternalContent() {
        for (let i = 0; i < this.messages.length; i++) {
            this.messages[i].parseExternalContent();
        }
        this.resetScheduled = false;
    }

    ensureMetaLoaded() {
        return asPromise(this, 'metaLoaded', true);
    }

    dispose() {
        try {
            this._reactionsToDispose.forEach(d => d());
            if (this._messageHandler) this._messageHandler.dispose();
            if (this._receiptHandler) this._receiptHandler.dispose();
            if (this._headHandler) this._headHandler.dispose();
        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = Chat;
