/**
 * DI module to use models and stores avoiding cyclic requires
 */
let volumeStore;
module.exports = {
    /**
     * Only VolumeStore needs this
     */
    setVolumeStore(store) {
        volumeStore = store;
    },
    /**
     * Use this to avoid cyclic requires
     * @returns {FileStore}
     */
    getVolumeStore() {
        return volumeStore;
    }
};
