const { observable, computed } = require('mobx');
const Chat = require('../chats/chat');
const { getChatStore } = require('../../helpers/di-chat-store');
const { getContactStore } = require('../../helpers/di-contact-store');

/**
 * Pending DM helper class
 * Mocks properties of Chat object to be displayed correctly by UI in chat lists
 * @param {string} username - user name of a registered user
 * @param {Date} timestamp - used to sort DMs with pending
 * @public
 */
class ChatPendingDM extends Chat {
    constructor(username) {
        super(`pending-dm:${username}`, [{ username }], getChatStore());
        this.username = username;
        this.loaded = true;
    }

    get name() { return this.username; }

    @computed get allParticipants() { return [getContactStore().getContact(this.username)]; }

    // stub function to imitate chat
    loadMetadata() {
        return Promise.resolve();
    }

    loadMostRecentMessage() {
        return Promise.resolve();
    }

    get headLoaded() { return true; }
    get disableActivate() { return true; }

    @observable unreadCount = 0;
    @observable username;
    @observable timestamp;
}

module.exports = ChatPendingDM;
