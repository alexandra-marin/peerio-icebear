const { observable, computed, action, when } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
const cryptoUtil = require('../../crypto/util');
const Volume = require('./volume');
const folderResolveMap = require('../files/folder-resolve-map');

function mockFolder(name) {
    const result = new Volume();
    result.name = name;
    result.folderId = cryptoUtil.getRandomShortIdHex();
    return result;
}

function waitMS(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function random(max) {
    return Math.floor(Math.random() * max);
}

function mockShareProgress(folder) {
    if (folder.shareTimeout) return Promise.resolve();
    folder.shareProgress = random(10);
    folder.shareTimeout = setInterval(() => {
        folder.shareProgress = Math.min(100, folder.shareProgress + random(40));
        if (folder.shareProgress >= 100) {
            clearInterval(folder.shareTimeout);
            folder.shareTimeout = undefined;
        }
    }, 500);
    return new Promise(resolve => when(() => folder.shareProgress === 100, resolve));
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

    // TODO: it is currently set on first deserialize
    // need to do something better
    rootFileFolder = undefined;

    @computed get sortedVolumes() {
        return this.volumes
            .sort((f1, f2) => f1.normalizedName > f2.normalizedName);
    }

    serialize() {
        console.log(`volume-store.js: serialization dummy`);
    }

    deserialize(parent) {
        if (this.volumes.length) return;
        this.rootFileFolder = parent;
        this.attachFolder(mockFolder('Test Shared Folder 1'));
        this.attachFolder(mockFolder('Test Shared Folder 2'));
    }

    attachFolder(folder) {
        this.volumes.push(folder);
        folder.parent = this.rootFileFolder;
        folderResolveMap.set(folder.folderId, folder);
    }

    @action.bound async shareFolder(folder) {
        const newFolder = mockFolder(folder.name);
        folder.isBlocked = true;
        await mockShareProgress(folder);
        folder.isHidden = true;
        this.attachFolder(newFolder);
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;

