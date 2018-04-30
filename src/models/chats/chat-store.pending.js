const ChatPendingDM = require('./chat-pending-dm');

class ChatStorePending {
    constructor(store) {
        this.store = store;
    }

    add(username) {
        this.store.addChat(new ChatPendingDM(username));
    }
}

module.exports = ChatStorePending;
