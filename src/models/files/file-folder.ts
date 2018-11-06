import warnings from '../warnings';
import { retryUntilSuccess } from '../../helpers/retry';
import { observable, computed, action } from 'mobx';
import * as util from '../../util';
import { getFileStore } from '../../helpers/di-file-store';
import { getUser } from '../../helpers/di-current-user';
import * as cryptoUtil from '../../crypto/util';
import FileStoreBase from './file-store-base';
import File from './file';
import Volume from '../volumes/volume';

function isLegacyFilePredicate(f: File) {
    return !!(f && f.isLegacy);
}
function hasLegacyFilesPredicate(f: FileFolder) {
    return !!(f && f.hasLegacyFiles);
}

interface FileFolderData {
    folderId: string;
    name: string;
    createdAt: number;
    folders: FileFolderData[];
}

export default class FileFolder {
    constructor(store: FileStoreBase, name?: string, isShared = false) {
        this.store = store;
        this.isRoot = name === '/';
        this.name = this.isRoot ? '' : name;
        this.isShared = isShared;
        if (this.isRoot && !isShared) {
            this.id = 'root';
        }
    }

    static kegUpdatedComparer = function(f1: File, f2: File) {
        return f2.kegUpdatedAt - f1.kegUpdatedAt;
    };

    isShared: boolean;
    // TODO: this is for  compatibility with File, to be able to process them in the same list
    isLegacy = false;
    shared = false;
    store: FileStoreBase;
    // ----

    // unique global id (local folder id, or volume id)
    @observable id: string = null;
    // to be able to filter easier when files and folders are in the same list
    readonly isFolder = true;
    // to indicate root folder or volume root
    isRoot = false;
    // this folder is a volume root
    // isShared = false;

    @observable name: string;
    // `parent` property depends on it
    @observable folderId: string;
    @observable createdAt: number;
    // to let systems know that this instance is no good anymore
    @observable isDeleted: boolean;

    @observable convertingToVolume?: Volume = null;
    @observable convertingFromFolder?: FileFolder = null; // when this is Volume (which extends FileFolder)

    get root() {
        return this.store.folderStore.root;
    }

    // array of files in the root of this folder
    @computed
    get files() {
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
    @computed
    get folders() {
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

    // does current folder have zero files/folders in it
    @computed
    get isEmpty() {
        return this.files.length + this.folders.length === 0;
    }

    // parent folder instance
    @computed
    get parent() {
        if (this.isRoot) {
            if (this.isShared && this.folderId === 'root') return getFileStore().folderStore.root;
            return null;
        }
        const p = this.store.folderStore.getById(this.folderId);
        return p || this.root;
    }

    @computed
    get owner() {
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
    @observable progressText: string = null;

    get progressPercentage() {
        return Math.round(this.progress / (this.progressMax * 0.01 || 1));
    }

    @computed
    get normalizedName() {
        return this.name ? this.name.toUpperCase() : '';
    }

    @computed
    get foldersSortedByName() {
        return this.folders.sort((f1, f2) => {
            if (f1.normalizedName < f2.normalizedName) return -1;
            if (f1.normalizedName > f2.normalizedName) return 1;
            return 0;
        });
    }

    @computed
    get filesSortedByDate() {
        return this.files.sort(FileFolder.kegUpdatedComparer);
    }

    @computed
    get filesAndFoldersDefaultSorting() {
        return (this.foldersSortedByName as Array<File | FileFolder>).concat(
            this.filesSortedByDate.slice()
        );
    }

    /** The total size, in bytes, of all files in this folder tree. */
    @computed
    get size(): number {
        let currentSize = 0;
        for (const folder of this.folders) {
            currentSize += folder.size;
        }
        for (const file of this.files) {
            currentSize += file.size;
        }
        return currentSize;
    }

    @computed
    get sizeFormatted(): string {
        return util.formatBytes(this.size);
    }

    /** The total file count in this folder tree. */
    @computed
    get totalFileCount(): number {
        let count = 0;
        for (const folder of this.folders) {
            count += folder.totalFileCount;
        }
        count += this.files.length;
        return count;
    }

    // array of all files in this folder tree
    @computed
    get allFiles(): File[] {
        let ret = this.files;
        this.folders.forEach(f => {
            ret = ret.concat(f.allFiles.slice());
        });
        return ret;
    }

    @computed
    get allFolders(): FileFolder[] {
        let ret = this.folders;
        this.folders.forEach(f => {
            ret = ret.concat(f.allFolders.slice());
        });
        return ret;
    }

    // has nested folders?
    get hasNested(): boolean {
        return this.folders && this.folders.length > 0;
    }

    // searches in this folder root
    findFolderByName(name: string): FileFolder {
        const normalizedName = name.toUpperCase();
        return this.folders.find(f => f.normalizedName === normalizedName);
    }

    // downloads all files in current folder, reconstructing folder structure and showing progress
    async download(
        path: string,
        pickPathSelector: (path: string, name: string, ext?: string) => Promise<string>,
        createDirFunctor: (path: string) => Promise<void>
    ) {
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
                await file.download(
                    await pickPathSelector(downloadPath, file.nameWithoutExtension, file.ext),
                    false,
                    false,
                    true // suppress snackbar
                );
                this.progress++;
            });
        });
        await promise;
        this.progressMax = null;
        this.progress = 0;
    }

    @computed
    get hasLegacyFiles(): boolean {
        return !!(
            this.folders.find(hasLegacyFilesPredicate) || this.files.find(isLegacyFilePredicate)
        );
    }

    // move file or folder
    attach(fileOrFolder, ...rest) {
        if (fileOrFolder.isFolder) {
            return this.attachFolder(fileOrFolder, ...rest);
        }
        return this.attachFile(fileOrFolder);
    }

    // move file to this folder
    @action.bound
    async attachFile(file: File): Promise<void> {
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

        return retryUntilSuccess(() => file.saveToServer(), {
            id: `saving file ${file.fileId}`,
            maxRetries: 5
        }).tapCatch(() => {
            file.load();
        });
    }

    // adds exiting folder instance to this folder
    @action.bound
    async attachFolder(
        folder: FileFolder,
        skipSave = false,
        skipRootFolder?: boolean
    ): Promise<void> {
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
    @action
    protected async copyFilesTo(dst, folderIdMap) {
        const src = this;
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = src.allFiles.length;
        await Promise.map(
            src.allFiles,
            file => {
                src.progress = ++dst.progress;
                const dstFolder = dst.store.folderStore.getById(folderIdMap[file.folderId]) || dst;
                return dstFolder.attachFile(file);
            },
            { concurrency: 1 }
        );
        src.progress = dst.progress = 0;
        src.progressMax = dst.progressMax = 0;
    }

    // private api
    @action
    protected async copyFolderStructureTo(dst: FileFolder, skipRootFolder = false) {
        const src = this;
        const folderIdMap: { [folderId: string]: string } = {}; // mapping between source folder ids and destination
        const copyFolders = (parentSrc: FileFolder, parentDst: FileFolder) => {
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
    createFolder(name: string, id?: string, skipSave = false) {
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

    rename(name: string) {
        if (this.parent.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            return;
        }
        this.name = name;
        this.store.folderStore.save();
    }

    serialize(): FileFolderData {
        // folderId is same as this.id, due to historical reasons.
        const { name, id, createdAt } = this;
        const folders = this.folders.filter(f => !f.isShared).map(f => f.serialize());
        return { name, folderId: id, createdAt, folders };
    }

    deserialize(data: FileFolderData, parentId: string) {
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
