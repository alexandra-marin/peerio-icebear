/**
 * DI module to use models and stores avoiding cyclic requires
 */
let chatStore;
module.exports = {
    /**
     * This is used by ChatStore module only
     */
    setChatStore(store) {
        chatStore = store;
    },
    /**
     * Use this from icebear when u want to avoid cyclic require
     * @returns {ChatStore} chat store instance
     */
    getChatStore() {
        return chatStore;
    }
};
