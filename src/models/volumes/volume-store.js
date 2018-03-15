const { observable, computed, action, when } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
const { getChatStore } = require('../../helpers/di-chat-store');
// const cryptoUtil = require('../../crypto/util');
const Volume = require('./volume');
const folderResolveMap = require('../files/folder-resolve-map');

function mockFolder(name) {
    const result = new Volume();
    result.name = name;
    result.folderId = `folderId${name}`;
    return result;
}

function random(max) {
    return Math.floor(Math.random() * max);
}

function mockProgress(folder) {
    if (folder.shareTimeout) return Promise.resolve();
    folder.progressMax = 100;
    folder.progress = random(10);
    folder.shareTimeout = setInterval(() => {
        folder.progress = Math.min(folder.progressMax, folder.progress + random(40));
        console.log(`progress: ${folder.progress}, ${folder.progressMax}`);
        if (folder.progress >= folder.progressMax) {
            clearInterval(folder.shareTimeout);
            folder.shareTimeout = undefined;
        }
    }, 500);
    return new Promise(resolve =>
        when(() => folder.progress === 100, () => {
            setTimeout(() => {
                resolve();
                folder.progress = null;
                folder.progressMax = null;
            }, 1000);
        }));
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
        this.attachFolder(mockFolder('My Shared Folder 1'));
        this.attachFolder(mockFolder('My Shared Folder 2'));
        const nonOwnedOne = mockFolder('Foreign Shared Folder 3');
        nonOwnedOne.owner = 'anri';
        nonOwnedOne.isOwner = false;
        this.attachFolder(nonOwnedOne);
    }

    attachFolder(folder) {
        if (folderResolveMap.get(folder.folderId)) return;
        this.volumes.push(folder);
        folder.parent = this.rootFileFolder;
        folderResolveMap.set(folder.folderId, folder);
    }

    @action.bound async convertFolder(folder) {
        if (!folder.isShared) {
            const newFolder = mockFolder(folder.name);
            folder.isBlocked = true;
            await mockProgress(folder);
            folder.isHidden = true;
            this.attachFolder(newFolder);
        }
    }

    @action.bound async shareFolder(folder, participants) {
        await this.convertFolder(folder);
        // TODO: add participants to folder
        // TODO: maybe a better way to start the chat
        let promise = Promise.resolve();
        participants.forEach(contact => {
            promise = promise.then(async () => {
                await getChatStore().startChatAndShareFiles([contact], [folder]);
            });
        });
        await promise;
    }

    @action.bound async deleteVolume(volume) {
        // TODO: put the delete logic into the AbstractFolder (???)
        const { files } = volume;
        volume.progress = 0;
        volume.progressMax = files.length;
        volume.progressText = 'title_deletingSharedFolder';
        let promise = Promise.resolve();
        files.forEach(file => {
            promise = promise.then(async () => {
                await file.remove();
                volume.progress++;
            });
        });
        await promise;
        volume.progressMax = null;
        volume.progress = null;
        // there's a lag between deletion and file disappearance from the
        // associated folder list. so to prevent confusion we clear files here
        volume.files = [];
        const i = this.volumes.indexOf(volume);
        if (i !== -1) {
            this.volumes.splice(i, 1);
            folderResolveMap.delete(volume.folderId);
        } else {
            console.error('volume-store: cannot find the folder');
        }
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;

