const { observable, computed, action, when } = require('mobx');
const socket = require('../../network/socket');
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
    constructor(username, email, isReceived) {
        super(`pending-dm:${username}`, [{ username }], getChatStore());
        this.username = username;
        this.email = email;
        this.loaded = true;
        this.metaLoaded = true;
        this.isReceived = isReceived;
    }

    get contact() {
        return getContactStore().getContact(this.username);
    }

    @computed get allParticipants() { return [getContactStore().getContact(this.username)]; }
    @computed get otherParticipants() { return this.allParticipants; }

    // stub function to imitate chat
    loadMetadata() {
        return Promise.resolve();
    }

    loadMostRecentMessage() {
        return Promise.resolve();
    }

    loadMessages() {
        return Promise.resolve();
    }

    @computed get recentFiles() {
        return [];
    }

    get headLoaded() { return true; }

    get isInvite() { return true; }

    // To prevent startChat from returning ChatPendingDM instance
    hasSameParticipants() { return false; }

    @observable unreadCount = 1;
    username;
    timestamp;

    @action.bound dismiss() {
        getChatStore().unloadChat(this);
        return this.isReceived ? this.removeReceivedInvite(this.username)
            : this.removeInvite(this.email);
    }

    @action.bound start() {
        const { contact } = this;
        contact.whenLoaded(() => {
            if (contact.notFound || contact.isDeleted) {
                console.error(`contact is not found or deleted`);
                return;
            }
            const chat = getChatStore().startChat([contact]);
            chat.isChatCreatedFromPendingDM = true;
            if (this.isReceived) chat.isNewUserFromInvite = true;
            when(() => chat.active, this.dismiss);
        });
    }

    /**
     * Removes invitation.
     * @param {string} email
     * @returns {Promise}
     * @public
     */
    removeInvite(email) {
        return socket.send('/auth/contacts/issued-invites/remove', { email });
    }

    /**
     * Removes incoming invitation. This is useful for new users, logic automatically adds authors of received invites
     * to favorites and then removes received invites.
     * @param {string} username
     * @returns {Promise}
     * @public
     */
    removeReceivedInvite(username) {
        return socket.send('/auth/contacts/received-invites/remove', { username });
    }
}

module.exports = ChatPendingDM;
