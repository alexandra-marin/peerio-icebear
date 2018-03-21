/**
 * DI module to use models and stores avoiding cyclic requires
 * @module helpers/di-volume-store
 * @protected
 */
let volumeStore;
module.exports = {
    /**
     * Only VolumeStore needs this
     * @protected
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
