const { observable, computed } = require('mobx');
const util = require('../../util');

class AbstractFolder {
    @observable.shallow files = [];
    @observable.shallow folders = [];
    @observable _name;
    @observable createdAt;
    @observable isDeleted;
    @observable isShared = false;

    isFolder = true;
    _folderId = null;
    get folderId() { return this._folderId; }
    set folderId(value) { this._folderId = value; }
    @observable parent = null;

    // Variables for bulk actions and share-related actions
    @observable selected = false;
    @observable progress = null;
    @observable progressMax = null;

    // optional text for progress actions
    @observable progressText = null;

    get name() { return this._name; }

    set name(value) { this._name = value; }

    get progressPercentage() {
        return Math.min(Math.ceil(this.progress / (this.progressMax | 1) * 100), 100);
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

    @computed get sizeFormatted() {
        return util.formatBytes(this.size);
    }

    @computed get totalFileCount() {
        let count = 0;
        for (const folder of this.folders) {
            count += folder.totalFileCount;
        }
        count += this.files.length;
        return count;
    }

    @computed get allFiles() {
        let ret = this.files;
        this.folders.forEach(f => {
            ret = ret.concat(f.allFiles);
        });
        return ret;
    }

    get isRoot() {
        return !this.parent;
    }

    get hasNested() {
        return this.folders && this.folders.length;
    }

    findFolderByName(name) {
        const normalizedName = name.toUpperCase();
        return this.folders.find(f => f.normalizedName === normalizedName);
    }

    async download(path, pickPathSelector, createDirFunctor) {
        const downloadPath = await pickPathSelector(
            path,
            this.name);
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

    serialize() {
        throw new Error('serialize is not implemented');
    }

    deserialize(/* dataItem, parent, folderResolveMap, newFolderResolveMap */) {
        throw new Error('deserialize is not implemented');
    }
}

module.exports = AbstractFolder;
