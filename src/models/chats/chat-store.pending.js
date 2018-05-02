const ChatPendingDM = require('./chat-pending-dm');

class ChatStorePending {
    constructor(store) {
        this.store = store;
    }

    add(username, email, received) {
        this.store.addChat(new ChatPendingDM(username, email, received));
    }
}

module.exports = ChatStorePending;
