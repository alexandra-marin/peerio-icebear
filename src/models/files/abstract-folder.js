const { observable, computed } = require('mobx');
const util = require('../../util');
// todo: isRoot, and add orphaned files and folders to the list
class AbstractFolder {
    constructor(store, isRoot = false, isShared = false) {
        this.store = store;
        this.isRoot = isRoot;
        this.isShared = isShared;
    }

    // to be able to filter easier when files and folders are in the same list
    isFolder = true;
    // to indicate root folder or volume root
    isRoot = false
    // basically this means we're in a volume
    isShared = false;

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
                if (!this.store.folderStore.getById(f.parent.folderId)) return true;
                return false;
            }
            return f.parent && f.parent.folderId === this.folderId;
        });
    }

    // parent folder instance
    @computed get parent() {
        if (this.isRoot) return null;
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

    add(/* file, skipSaving */) {
        throw new Error('add is not implemented');
    }

    addFolder(/* folder */) {
        throw new Error('addFolder is not implemented');
    }

    free(/* file */) {
        throw new Error('free is not implemented');
    }

    freeFolder(/* folder */) {
        throw new Error('freeFolder is not implemented');
    }

    remove() {
        throw new Error('remove is not implemented');
    }

    moveInto(/* file */) {
        throw new Error('moveInto is not implemented');
    }

    rename(/* name */) {
        throw new Error('rename is not implemented');
    }
}

module.exports = AbstractFolder;
