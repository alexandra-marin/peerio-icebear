const warnings = require('../warnings');
const { retryUntilSuccess } = require('../../helpers/retry');
const { observable, computed, action } = require('mobx');
const util = require('../../util');
const { getFileStore } = require('../../helpers/di-file-store');
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
            this.folderId = 'root';
        }
    }

    // unique global id (local folder id, or volume id)
    // folderId;
    // to be able to filter easier when files and folders are in the same list
    isFolder = true;
    // to indicate root folder or volume root
    isRoot = false
    // this folder is a volume root
    // isShared = false;

    @observable name;
    // string, `parent` property depends on it
    @observable parentId;
    // number
    @observable createdAt;
    // to let systems know that this instance is no good anymore
    @observable isDeleted;

    // array of files in the root of this folder
    @computed get files() {
        return this.store.files.filter(f => {
            if (this.isRoot) {
                // orphaned files belong to root
                if (!f.folderId) return true;
                if (!this.store.folderStore.getById(f.folderId)) return true;
                return false;
            }
            return f.folderId === this.folderId;
        });
    }

    // array of folders in the root of this folder
    @computed get folders() {
        return this.store.folderStore.folders.filter(f => {
            if (this.isRoot) {
                // orphaned folders belong to root
                if (!f.parent) return true;
                // if this folder is in root of volume, parent will be root too
                if (f.parent.isRoot || f.parent.isDeleted || !this.store.folderStore.getById(f.parent.folderId)) {
                    return true;
                }
                return false;
            }
            return f.parent && f.parent.folderId === this.folderId;
        });
    }

    // parent folder instance
    @computed get parent() {
        if (this.isRoot) {
            if (this.isShared && this.parentId === 'root') return getFileStore().folderStore.root;
            return null;
        }
        const p = this.store.folderStore.getById(this.parentId);
        return p || this.store.folderStore.root;
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

    @computed get foldersAndFilesDefaultSorting() {
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
    attach(fileOrFolder) {
        if (fileOrFolder.isFolder) {
            this.attachFolder(fileOrFolder);
        } else {
            this.attachFile(fileOrFolder);
        }
    }

    // move file to this folder
    @action.bound async attachFile(file) {
        if (file.store !== this.store) {
            // this is an inter-volume operation!
            await file.copyTo(this.db, this.store);
            // if file was shared not from SELF - remove it
            // file kegs in SELF will get hidden by server
            if (!file.store.isMainStore) {
                await file.remove();
            }
            // file instance is removed, destination will reload it
            return Promise.resolve();
        }
        file.folderId = this.isRoot ? null : this.folderId;

        return retryUntilSuccess(
            () => file.saveToServer(),
            `saving file ${file.fileId}`,
            5
        ).tapCatch(() => {
            file.load();
        });
    }

    // adds exiting folder instance to this folder
    @action.bound async attachFolder(folder, skipSave) {
        if (folder.store !== this.store) {
            // 1. we copy folder structure to another kegdb
            await folder.copyFolderStructureTo(this);
            // 2. we copy files
            await folder.copyFilesTo(this);
            // 3. we remove original files and folders
            folder.remove(folder.store.isMainStore);
            return Promise.resolve();
        }
        if (this.findFolderByName(folder.normalizedName)) {
            warnings.addSevere('error_folderAlreadyExists');
            return Promise.reject();
        }
        folder.parentId = this.folderId;
        if (!this.store.folderStore.getById(folder.folderId)) {
            this.store.folderStore.folders.push(folder);
        }
        return skipSave ? Promise.resolve() : this.store.folderStore.save(); // retry handled inside
    }

    // private api, copies files from one db to another, preserving folder ids
    @action async copyFilesTo(dst) {
        const src = this;
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = src.allFiles.length;
        Promise.map(src.allFiles, file => {
            src.progress = ++dst.progress;
            return dst.attachFile(file);
        }, { concurrency: 1 });
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = 0;
    }

    // private api
    @action async copyFolderStructureTo(dst) {
        const src = this;
        const copyFolders = (parentSrc, parentDst) => {
            parentSrc.folders.forEach(f => {
                const folder = parentDst.createFolder(f.name, f.id, true);
                copyFolders(f, folder);
            });
        };
        const dstRoot = dst.createFolder(src.name, src.id, true);
        copyFolders(src, dstRoot);
        return dst.store.folderStore.save();
    }
    // creates new child folder
    createFolder(name, id, skipSave = false) {
        if (this.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            throw new Error('error_folderAlreadyExists');
        }
        const folder = new FileFolder(this.store, name);
        const folderId = id || cryptoUtil.getRandomShortIdHex();
        folder.folderId = folderId;
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
        const { name, folderId, createdAt } = this;
        const folders = this.folders.filter(f => !f.isShared).map(f => f.serialize());
        return { name, folderId, createdAt, folders };
    }

    deserialize(data, parentId) {
        if (this.folderId && data.folderId !== this.folderId) {
            throw new Error('Trying to deserialize folder from a different folder data');
        }
        this.folderId = data.folderId;
        this.name = data.name;
        this.createdAt = data.createdAt;
        this.parentId = parentId;
        return this;
    }
}

module.exports = FileFolder;
