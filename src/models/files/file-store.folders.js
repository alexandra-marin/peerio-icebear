const { observable, action, reaction, computed } = require('mobx');
const tracker = require('../update-tracker');
const FileFolder = require('./file-folder');
const FileFoldersKeg = require('./file-folders-keg');
const createMap = require('../../helpers/dynamic-array-map');
const { retryUntilSuccess } = require('../../helpers/retry');

class FileStoreFolders {
    constructor(fileStore, root) {
        this.fileStore = fileStore;
        this.root = root || new FileFolder(fileStore, '/');
        this.currentFolder = this.root;

        tracker.onceUpdated(() => {
            this.keg = new FileFoldersKeg(fileStore.kegDb);
            this.keg.onUpdated = () => { this.sync(); };
        });
        reaction(() => this.currentFolder.isDeleted, deleted => {
            if (deleted) this.currentFolder = this.root;
        });
        const map = createMap(this.folders, 'id');
        this.foldersMap = map.observableMap;
    }

    // flat folders array, every other folder array is computed from this one
    @observable.shallow folders = [];
    // will update automatically when folders array changes
    @observable foldersMap;

    @observable loaded = false;
    @observable keg = null;

    @observable currentFolder;

    getById(id) {
        if (id && id.startsWith('volume:') && this.root.isShared) {
            return this.root;
        }
        return this.foldersMap.get(id);
    }

    searchAllFoldersByName(name) {
        const q = name ? name.toLowerCase() : '';
        return this.root.allFolders
            .filter(f => f.normalizedName.includes(q));
    }

    @computed get selectedFolders() {
        let ret = this.folders.filter(f => f.selected);
        if (!this.fileStore.isMainStore) return ret;
        this.fileStore.getFileStoreInstances()
            .forEach(store => {
                ret = ret.concat(store.folderStore.folders.filter(f => f.selected));
            });
        return ret;
    }

    // saves folder structure to keg
    save() {
        return retryUntilSuccess(
            () => this.keg.save(
                () => {
                    this.keg.folders = this.root.folders.filter(f => !f.isShared).map(f => f.serialize());
                    return true;
                },
                null,
                'error_savingFileFolders'
            ),
            `saving file folders keg for ${this.fileStore.id}`,
            5
        ).catch(() => this.sync());
    }

    // to avoid recursive calls of action and action nesting in result
    _syncFolder = (folderData, parentId, newTreeMap) => {
        newTreeMap[folderData.folderId] = 1; // just to mark existence
        const existing = this.foldersMap.get(folderData.folderId);
        if (existing) {
            existing.deserialize(folderData, parentId);
        } else {
            const folder = new FileFolder(this.fileStore);
            folder.deserialize(folderData, parentId);
            this.folders.push(folder);
        }
        folderData.folders.forEach((child) => this._syncFolder(child, folderData.folderId, newTreeMap));
    };

    // reconstructs folder structure from keg data
    @action.bound sync() {
        // we will collect all id from keg data in here during sync
        // so we can detect removed folders afterwards
        const newTreeMap = {};
        this.keg.folders.forEach((folderData) => this._syncFolder(folderData, null, newTreeMap));
        this.folders.forEach(folder => {
            if (!folder.isRoot && !newTreeMap[folder.id]) {
                this.folders.remove(folder);
            }
        });
    }
}

module.exports = FileStoreFolders;
