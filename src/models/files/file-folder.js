const warnings = require('../warnings');
const { retryUntilSuccess } = require('../../helpers/retry');
const { observable, computed, action } = require('mobx');
const util = require('../../util');
const { getFileStore } = require('../../helpers/di-file-store');
const { getUser } = require('../../helpers/di-current-user');
const cryptoUtil = require('../../crypto/util');

function isLegacyFilePredicate(f) {
    return !!(f && f.isLegacy);
}
function hasLegacyFilesPredicate(f) {
    return !!(f && f.hasLegacyFiles);
}

class FileFolder {
    constructor(store, name, isShared) {
        this.store = store;
        this.isRoot = name === '/';
        this.name = this.isRoot ? '' : name;
        this.isShared = isShared;
        if (this.isRoot && !isShared) {
            this.id = 'root';
        }
    }

    // unique global id (local folder id, or volume id)
    @observable id = null;
    // to be able to filter easier when files and folders are in the same list
    isFolder = true;
    // to indicate root folder or volume root
    isRoot = false
    // this folder is a volume root
    // isShared = false;

    @observable name;
    // string, `parent` property depends on it
    @observable folderId;
    // number
    @observable createdAt;
    // to let systems know that this instance is no good anymore
    @observable isDeleted;

    @observable convertingToVolume = false;

    get root() {
        return this.store.folderStore.root;
    }

    // array of files in the root of this folder
    @computed get files() {
        return this.store.files.filter(f => {
            if (f.hidden) return false;
            if (this.isRoot) {
                // orphaned files belong to root
                if (!f.folderId) return true;
                if (!this.store.folderStore.getById(f.folderId)) return true;
                return false;
            }
            return f.folderId === this.id;
        });
    }

    // array of folders in the root of this folder
    @computed get folders() {
        return this.store.folderStore.folders.filter(f => {
            if (this.isRoot) {
                // orphaned folders belong to root
                if (!f.parent) return true;
                // if this folder(f) is in root of volume, parent(this) will be root too
                if (f.parent.isRoot) {
                    return true;
                }
                // items with deleted or unmounted parents also go to the root (this)
                if (f.parent.isDeleted || !this.store.folderStore.getById(f.parent.id)) {
                    return true;
                }
                return false;
            }
            return f.folderId === this.id;
        });
    }

    // parent folder instance
    @computed get parent() {
        if (this.isRoot) {
            if (this.isShared && this.folderId === 'root') return getFileStore().folderStore.root;
            return null;
        }
        const p = this.store.folderStore.getById(this.folderId);
        return p || this.root;
    }

    @computed get owner() {
        if (!this.isShared && !this.root.isShared) return getUser().username;
        // store and kegDb already exist and never change.
        // boot is observable
        const boot = this.store.kegDb.boot;
        return boot.loaded ? boot.owner : null;
    }

    get canShare() {
        return !(this.isShared || this.root.isShared);
    }

    // Variables for bulk actions and share-related actions
    @observable selected = false;
    // for whatever long-running process is being performed on the folder
    @observable progress = 0;
    @observable progressMax = 0;
    // optional text for progress actions
    @observable progressText = null;

    get progressPercentage() {
        return Math.round(this.progress / (this.progressMax * 0.01 || 1));
    }

    @computed get normalizedName() {
        return this.name ? this.name.toUpperCase() : '';
    }

    @computed get foldersSortedByName() {
        return this.folders.sort((f1, f2) => f1.normalizedName > f2.normalizedName);
    }

    @computed get filesSortedByDate() {
        return this.files.sort((f1, f2) => f2.uploadedAt - f1.uploadedAt);
    }

    @computed get filesAndFoldersDefaultSorting() {
        return this.foldersSortedByName.concat(this.filesSortedByDate);
    }

    // number of bytes, total size of all files in this folder tree
    @computed get size() {
        let currentSize = 0;
        for (const folder of this.folders) {
            currentSize += folder.size;
        }
        for (const file of this.files) {
            currentSize += file.size;
        }
        return currentSize;
    }
    // string
    @computed get sizeFormatted() {
        return util.formatBytes(this.size);
    }
    // number, total file count in this folder tree
    @computed get totalFileCount() {
        let count = 0;
        for (const folder of this.folders) {
            count += folder.totalFileCount;
        }
        count += this.files.length;
        return count;
    }

    // array of all files in this folder tree
    @computed get allFiles() {
        let ret = this.files;
        this.folders.forEach(f => {
            ret = ret.concat(f.allFiles);
        });
        return ret;
    }

    @computed get allFolders() {
        let ret = this.folders;
        this.folders.forEach(f => {
            ret = ret.concat(f.allFolders);
        });
        return ret;
    }

    // has nested folders?
    get hasNested() {
        return this.folders && this.folders.length;
    }

    // searches in this folder root
    findFolderByName(name) {
        const normalizedName = name.toUpperCase();
        return this.folders.find(f => f.normalizedName === normalizedName);
    }

    // downloads all files in current folder, reconstructing folder structure and showing progress
    async download(path, pickPathSelector, createDirFunctor) {
        const downloadPath = await pickPathSelector(path, this.name);
        this.progress = 0;
        this.progressMax = this.files.length + this.folders.length;
        await createDirFunctor(downloadPath);
        let promise = Promise.resolve();
        this.folders.forEach(folder => {
            promise = promise.then(async () => {
                await folder.download(downloadPath, pickPathSelector, createDirFunctor);
                this.progress++;
            });
        });
        this.files.forEach(file => {
            promise = promise.then(async () => {
                await file.download(pickPathSelector(downloadPath, file.nameWithoutExtension, file.ext));
                this.progress++;
            });
        });
        await promise;
        this.progressMax = null;
        this.progress = 0;
    }


    @computed get hasLegacyFiles() {
        return !!(this.folders.find(hasLegacyFilesPredicate) || this.files.find(isLegacyFilePredicate));
    }

    // move file or folder
    attach(fileOrFolder, ...rest) {
        if (fileOrFolder.isFolder) {
            return this.attachFolder(fileOrFolder, ...rest);
        }
        return this.attachFile(fileOrFolder, ...rest);
    }

    // move file to this folder
    @action.bound async attachFile(file) {
        if (file.store !== this.store) {
            if (file.isLegacy) {
                console.error('can not share legacy file', file.fileId);
                // don't want to break batch process or initiate retry, this is the fastest way
                // since this should not really happen if UI is not buggy, it's acceptable
                return Promise.resolve();
            }
            // this is an inter-volume operation!
            await file.copyTo(this.store.kegDb, this.store, this.isRoot ? null : this.id);
            // if file was shared not from SELF - remove it
            // file kegs in SELF will get hidden by server
            if (!file.store.isMainStore) {
                await file.remove();
            }
            // in any case we want this file to not be visible anymore,
            // there might be a slight delay until server hides the keg and the data will get updated
            file.hidden = true;
            // file instance is removed, destination will reload it
            return Promise.resolve();
        }
        file.folderId = this.isRoot ? null : this.id;

        return retryUntilSuccess(
            () => file.saveToServer(),
            `saving file ${file.fileId}`,
            5
        ).tapCatch(() => {
            file.load();
        });
    }

    // adds exiting folder instance to this folder
    @action.bound async attachFolder(folder, skipSave, skipRootFolder) {
        if (folder === this) return Promise.resolve();
        if (folder.store !== this.store) {
            // 1. we copy folder structure to another kegdb
            const map = await folder.copyFolderStructureTo(this, skipRootFolder);
            // 2. we copy files
            await folder.copyFilesTo(this, map);
            // 3. we remove original folders, files have been removed individually already
            //    if user has added some files after process has started - they're safely in root now
            folder.remove(true);
            return Promise.resolve();
        }
        folder.folderId = this.id;
        if (!this.store.folderStore.getById(folder.id)) {
            this.store.folderStore.folders.push(folder);
        }
        return skipSave ? Promise.resolve() : this.store.folderStore.save(); // retry handled inside
    }

    // private api, copies files from one db to another, preserving folder ids
    @action async copyFilesTo(dst, folderIdMap) {
        const src = this;
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = src.allFiles.length;
        await Promise.map(src.allFiles, file => {
            src.progress = ++dst.progress;
            const dstFolder = dst.store.folderStore.getById(folderIdMap[file.folderId]) || dst;
            return dstFolder.attachFile(file);
        }, { concurrency: 1 });
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = 0;
    }

    // private api
    @action async copyFolderStructureTo(dst, skipRootFolder) {
        const src = this;
        const folderIdMap = {}; // mapping between source folder ids and destination
        const copyFolders = (parentSrc, parentDst) => {
            parentSrc.folders.forEach(f => {
                const folder = parentDst.createFolder(f.name, null, true);
                folderIdMap[f.id] = folder.id;
                copyFolders(f, folder);
            });
        };
        let dstRoot;
        if (skipRootFolder) {
            dstRoot = dst;
        } else {
            dstRoot = dst.createFolder(src.name, null, true);
            folderIdMap[src.id] = dstRoot.id;
        }
        copyFolders(src, dstRoot);
        return dst.store.folderStore.save().return(folderIdMap);
    }
    // creates new child folder
    createFolder(name, id, skipSave = false) {
        if (this.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            throw new Error('error_folderAlreadyExists');
        }
        const folder = new FileFolder(this.store, name);
        const newFolderId = id || cryptoUtil.getRandomShortIdHex();
        folder.id = newFolderId;
        folder.createdAt = Date.now();
        this.attachFolder(folder, skipSave);
        return folder;
    }

    // removed folder tree entirely, including files
    remove(keepFiles = false, skipSave = false) {
        if (this.isRoot) return;
        if (!keepFiles) this.files.forEach(f => f.remove());
        this.folders.forEach(f => f.remove(keepFiles, true));
        this.isDeleted = true;
        this.store.folderStore.folders.remove(this);
        if (skipSave) return;
        this.store.folderStore.save(); // retry handled inside
    }


    rename(name) {
        if (this.parent.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            return;
        }
        this.name = name;
        this.store.folderStore.save();
    }


    serialize() {
        // folderId is same as this.id, due to historical reasons.
        const { name, id, createdAt } = this;
        const folders = this.folders.filter(f => !f.isShared).map(f => f.serialize());
        return { name, folderId: id, createdAt, folders };
    }

    deserialize(data, parentId) {
        if (this.id && data.folderId !== this.id) {
            throw new Error('Trying to deserialize folder from a different folder data');
        }
        this.id = data.folderId; // 'folderId' is legacy name, don't want to migrate
        this.name = data.name;
        this.createdAt = data.createdAt;
        this.folderId = parentId;
        return this;
    }
}

module.exports = FileFolder;
