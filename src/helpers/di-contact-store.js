/**
 * DI module to use models and stores avoiding cyclic requires
 */
let contactStore;
module.exports = {
    /**
     * This is used by ContactStore module only
     */
    setContactStore(store) {
        contactStore = store;
    },
    /**
     * Use this from icebear when u want to avoid cyclic require
     * @returns {ContactStore} contact store instance
     */
    getContactStore() {
        return contactStore;
    }
};
