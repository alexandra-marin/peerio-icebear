const { observable } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');

/**
 * Volume store.
 * @namespace
 * @public
 */
class VolumeStore {
    /**
     * Full list of user's files.
     * @member {ObservableArray<File>} files
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable.shallow volumes = [];
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;

