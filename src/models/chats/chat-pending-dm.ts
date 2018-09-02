import { observable, computed, action, when } from 'mobx';
import Chat from '../chats/chat';
import { getChatStore } from '../../helpers/di-chat-store';
import { getContactStore } from '../../helpers/di-contact-store';

/**
 * Pending DM helper class
 * Mocks properties of Chat object to be displayed correctly by UI in chat lists
 */
class ChatPendingDM extends Chat {
    constructor(username: string, email: string, isReceived: boolean, isAutoImport = false) {
        super(`pending-dm:${username}`, [getContactStore().getContact(username)], getChatStore());
        this.username = username;
        this.email = email;
        this.isAutoImport = isAutoImport;
        this.loaded = true;
        this.metaLoaded = true;
        this.isReceived = isReceived;
    }

    email: string;
    isAutoImport: boolean;
    loaded: boolean;
    isReceived: boolean;

    get contact() {
        return getContactStore().getContact(this.username);
    }

    @computed
    get allParticipants() {
        return [getContactStore().getContact(this.username)];
    }
    @computed
    get otherParticipants() {
        return this.allParticipants;
    }

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

    @computed
    get recentFiles() {
        return [];
    }

    get headLoaded() {
        return true;
    }

    get isInvite() {
        return true;
    }

    // To prevent startChat from returning ChatPendingDM instance
    hasSameParticipants() {
        return false;
    }

    @observable unreadCount = 1;
    username;
    timestamp;

    @action.bound
    dismiss() {
        getChatStore().unloadChat(this);
        return this.isReceived
            ? getContactStore().removeReceivedInvite(this.username)
            : getContactStore().removeInvite(this.email);
    }

    @action.bound
    start() {
        const { contact } = this;
        contact.whenLoaded(async () => {
            if (contact.notFound || contact.isDeleted) {
                console.error(`contact is not found or deleted`);
                return;
            }
            const chat = await getChatStore().startChat([contact]);
            chat.isChatCreatedFromPendingDM = true;
            if (this.isReceived) chat.isNewUserFromInvite = true;
            when(() => chat.active, this.dismiss);
        });
    }
}

export default ChatPendingDM;
