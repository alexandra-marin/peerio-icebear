import ChatPendingDM from './chat-pending-dm';

class ChatStorePending {
    constructor(store) {
        this.store = store;
    }

    add(username, email, received, isAutoImport) {
        // edge case: if the chat list loaded before invites
        // and there was already a DM created
        if (this.store.directMessages.find(s => s.dmPartnerUsername === username)) {
            console.error(`user invitation ${username} already has a created DM`);
            return;
        }
        const pendingDM = new ChatPendingDM(username, email, received, isAutoImport);
        this.store.addChat(pendingDM);
    }

    onChatAdded(chat) {
        // TODO: invitation logic for channel will go here, too
        if (chat.isChannel) return;
        // we're not gonna remove invites we just added
        if (chat.isInvite) {
            return;
        }
        const username = chat.dmPartnerUsername;
        const existing = this.store.directMessages.find(s => s.isInvite && s.username === username);
        if (existing && existing.isInvite) {
            existing.dismiss();
        }
    }
}

export default ChatStorePending;
