const { computed } = require('mobx');
const ChatPendingDM = require('./chat-pending-dm');

class ChatStorePending {
    constructor(store) {
        this.store = store;
    }

    @computed get dmAndPendingMap() {
        const result = {};
        this.store.directMessages
            .forEach(chat => {
                result[chat.otherUsernameForDM] = chat;
            });
        return result;
    }

    add(username, email, received) {
        // edge case: if the chat list loaded before invites
        // and there was already a DM created
        if (this.dmAndPendingMap[username]) {
            console.error(`user invitation ${username} already has a created DM`);
            return;
        }
        const pendingDM = new ChatPendingDM(username, email, received);
        this.store.addChat(pendingDM);
    }

    onChatAdded(chat) {
        // TODO: invitation logic for channel will go here, too
        if (chat.isChannel) return;
        // we're not gonna remove invites we just added
        if (chat.isInvite) {
            return;
        }
        const username = chat.otherUsernameForDM;
        const existing = this.dmAndPendingMap[username];
        if (existing && existing.isInvite) {
            existing.dismiss();
        }
    }
}

module.exports = ChatStorePending;
