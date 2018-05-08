const { observable, action, reaction, computed } = require('mobx');
const { getUser } = require('../../helpers/di-current-user');
const tracker = require('../update-tracker');
const FileFolder = require('./file-folder');
const FileFoldersKeg = require('./file-folders-keg');
const cryptoUtil = require('../../crypto/util');
const warnings = require('../warnings');
const createMap = require('../../helpers/dynamic-array-map');

class FileStoreFolders {
    constructor(fileStore) {
        this.fileStore = fileStore;
        this.root = new FileFolder(fileStore, '/');
        this.currentFolder = this.root;

        tracker.onceUpdated(() => {
            this.keg = new FileFoldersKeg(getUser().kegDb);
            this.keg.onUpdated = () => { this.sync(); };
        });
        reaction(() => this.currentFolder.isDeleted, deleted => {
            if (deleted) this.currentFolder = this.root;
        });
        const map = createMap(this.folders, 'folderId');
        this.foldersMap = map.observableMap;
    }

    // flat folders array
    @observable.shallow folders = [];
    // will update automatically when folders array changes
    @observable foldersMap;

    @observable loaded = false;
    @observable keg = null;

    @observable currentFolder;

    folderIdReactions = {};

    getById(id) {
        return this.foldersMap.get(id);
    }

    searchAllFoldersByName(name) {
        const q = name ? name.toLowerCase() : '';
        return this.folders
            .filter(f => f.normalizedName.includes(q));
    }

    @computed get selectedFolders() {
        return this.folders.filter(f => f.selected);
    }

    // async deleteFolder(folder) {
    //     // TODO: put the delete logic into the AbstractFolder (???)
    //     const { files } = folder;
    //     folder.progress = 0;
    //     folder.progressMax = files.length;
    //     folder.progressText = 'title_deletingFolder';
    //     let promise = Promise.resolve();
    //     files.forEach(file => {
    //         promise = promise.then(async () => {
    //             await file.remove();
    //             folder.progress++;
    //         });
    //     });
    //     await promise;
    //     folder.progressMax = null;
    //     folder.progress = null;
    //     folder.progressText = null;
    //     // there's a lag between deletion and file disappearance from the
    //     // associated folder list. so to prevent confusion we clear files here
    //     folder.files = [];
    //     folder.remove();
    //     this.save();
    // }

    /**
     * Deletes only the folder and does not delete files
     * Useful for converting folder into a shared one
     * @param {FileFolder} folder
     */
    async deleteFolderSkipFiles(folder) {
        folder.parent.freeFolder(folder);
        folder.isDeleted = true;
        this.save();
    }

    createFolder(name, parent, id) {
        const target = parent || this.root;
        if (target.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            throw new Error('error_folderAlreadyExists');
        }
        const folder = new FileFolder(parent.store, name);
        const folderId = id || cryptoUtil.getRandomShortIdHex();
        folder.folderId = folderId;
        folder.createdAt = Date.now();
        target.addFolder(folder);
        return folder;
    }

    save() {
        this.keg.save(
            () => {
                this.keg.folders = this.root.folders.map(f => f.serialize());
                return true;
            },
            null,
            'error_savingFileFolders'
        ).catch(() => this.sync());
    }

    // to avoid recursive calls of action and action nesting in result
    _syncFolder = (f, parentId) => {
        const existing = this.foldersMap.get(f.folderId);
        if (existing) {
            existing.deserialize(f, parentId);
        } else {
            const folder = new FileFolder(this.fileStore);
            folder.deserialize(f, parentId);
            this.folders.push(folder);
        }
        f.folders.forEach((child) => this._syncFolder(child, f.folderId));
    };
    @action.bound sync() {
        this.keg.folders.forEach((f) => this._syncFolder(f, null));
    }
}

module.exports = FileStoreFolders;
