import { resolve } from 'bluebird';

const { observable, computed } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
const cryptoUtil = require('../../crypto/util');
const Volume = require('./volume');

function mockFolder(name) {
    const result = new Volume();
    result.name = name;
    result.folderId = cryptoUtil.getRandomShortIdHex();
    return result;
}
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

    @computed get sortedVolumes() {
        return this.volumes
            .sort((f1, f2) => f1.normalizedName > f2.normalizedName);
    }

    serialize() {
        console.log(`volume-store.js: serialization dummy`);
    }

    deserialize(parent, resolveMap) {
        if (this.volumes.length) return;
        this.attachFolder(mockFolder('Test Shared Folder 1'), parent, resolveMap);
        this.attachFolder(mockFolder('Test Shared Folder 2'), parent, resolveMap);
    }

    attachFolder(folder, parent, resolveMap) {
        this.volumes.push(folder);
        folder.parent = parent;
        resolveMap[folder.folderId] = folder;
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;

