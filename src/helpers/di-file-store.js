/**
 * DI module to use models and stores avoiding cyclic requires
 */
let fileStore;
module.exports = {
    /**
     * Only FileStore needs this
     */
    setFileStore(store) {
        fileStore = store;
    },
    /**
     * Use this to avoid cyclic requires
     * @returns {FileStore}
     */
    getFileStore() {
        return fileStore;
    }
};
