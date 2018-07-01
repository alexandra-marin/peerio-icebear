const { observable, action, runInAction, computed } = require('mobx');
const socket = require('../../network/socket');
const File = require('./file');
const tracker = require('../update-tracker');
const _ = require('lodash');
const { retryUntilSuccess } = require('../../helpers/retry');
const createMap = require('../../helpers/dynamic-array-map');
const FileStoreFolders = require('./file-store.folders');
const { getUser } = require('../../helpers/di-current-user');
const { getFileStore } = require('../../helpers/di-file-store');
const config = require('../../config');

// const PAGE_SIZE = 25;
function isFileSelected(file) {
    return file.selected;
}

function isSelectedFileShareable(file) {
    return !file.selected ? true : file.canShare;
}

class FileStoreBase {
    // #region File store instances
    static instances = observable.map();
    getFileStoreById(id) {
        if (id === 'main') return getFileStore();
        return FileStoreBase.instances.get(id);
    }

    getFileStoreInstances() {
        return FileStoreBase.instances;
    }
    dispose() {
        FileStoreBase.instances.delete(this.id);
    }
    // #endregion

    constructor(kegDb, root = null, id) {
        this.id = id; // something to identify this instance in runtime
        this._kegDb = kegDb;
        const m = createMap(this.files, 'fileId');
        this.fileMap = m.map;
        this.fileMapObservable = m.observableMap;
        this.folderStore = new FileStoreFolders(this, root);
        if (id !== 'main') {
            FileStoreBase.instances.set(this.id, this);
        } else {
            tracker.onceUpdated(this.onFileDigestUpdate);
        }
    }

    // #region Properties
    @observable.shallow files = [];
    // Filter to apply when computing search for files and folders
    @observable searchQuery = '';
    // Store is loading full file list for the first time.
    @observable loading = false;
    // Will set to true after file list has been updated upon reconnect.
    @observable updatedAfterReconnect = true;
    // Initial file list was loaded.
    @observable loaded = false;
    // Currently updating files from server
    updating = false;

    maxUpdateId = '';
    knownUpdateId = '';

    // #endregion

    // #region Computed and getters
    get kegDb() {
        return this._kegDb || getUser().kegDb;
    }

    // all files currently loaded in RAM, including volumes, excluding chats
    @computed get allFiles() {
        let ret = this.files;
        if (this.isMainStore) {
            FileStoreBase.instances.forEach(store => { ret = ret.concat(store.files.slice()); });
        }
        return ret;
    }

    // Subset of files not currently hidden by any applied filters
    @computed get filesSearchResult() {
        if (!this.searchQuery) return [];
        const q = this.searchQuery.toUpperCase();
        return this.allFiles
            .filter(f => f.normalizedName.includes(q));
    }

    // Subset of folders not currently hidden by any applied filters
    @computed get foldersSearchResult() {
        if (!this.searchQuery) return [];
        const q = this.searchQuery.toUpperCase();
        return this.folderStore.root.allFolders
            .filter(f => f.normalizedName.includes(q));
    }

    // Subset of files and folders not currently hidden by any applied filters
    @computed get filesAndFoldersSearchResult() {
        return this.foldersSearchResult.concat(this.filesSearchResult);
    }

    @computed get hasSelectedFiles() {
        return this.allFiles.some(isFileSelected);
    }

    @computed get hasSelectedFilesOrFolders() {
        return this.selectedFilesOrFolders.length;
    }

    @computed get canShareSelectedFiles() {
        return this.hasSelectedFiles && this.allFiles.every(isSelectedFileShareable);
    }
    // Returns currently selected files (file.selected == true)
    @computed get selectedFiles() {
        return this.allFiles.filter(isFileSelected);
    }

    // Returns currently selected folders (folder.selected == true)
    get selectedFolders() {
        return getFileStore().folderStore.selectedFolders;
    }

    @computed get selectedFilesOrFolders() {
        return this.selectedFolders.concat(this.selectedFiles);
    }

    // #endregion

    // #region functions and actions
    /**
     * Finds file in user's drive by fileId. Creates a mobx subscription.
     * @param {string} fileId
     * @returns {?File}
     */
    getById(fileId) {
        return this.fileMapObservable.get(fileId);
    }
    /**
     * Finds file in user's drive by kegId. This is not used often, only to detect deleted descriptor and remove file
     * from memory, since deleted keg has no props to link it to the file.
     * @param {string} kegId
     * @returns {?File}
     */
    getByKegId(kegId) {
        return this.files.find(f => f.id === kegId);
    }

    getFilesSharedBy(username) {
        return this.files.filter(f => f.owner === username);
    }

    // Deselects all files and folders
    @action clearSelection() {
        this.selectedFilesOrFolders.forEach(f => { f.selected = false; });
    }

    // Deselects unshareable files
    @action deselectUnshareableFiles() {
        this.selectedFilesOrFolders.forEach(f => {
            if (f.canShare) return;
            f.selected = false;
        });
    }
    // #endregion

    // #region Files update logic

    onFileDigestUpdate = _.debounce(() => {
        const digest = tracker.getDigest(this.kegDb.id, 'file');
        // this.unreadFiles = digest.newKegsCount;
        if (this.loaded && digest.maxUpdateId === this.maxUpdateId) {
            this.updatedAfterReconnect = true;
            return;
        }
        this.maxUpdateId = digest.maxUpdateId;
        this.updateFiles();
    }, 1500, { leading: true, maxWait: 3000 });

    async getFileKegsFromServer() {
        const filter = { collectionVersion: { $gte: this.knownUpdateId } };
        if (!this.loaded) {
            filter.deleted = false;
        }
        const options = { /* count: PAGE_SIZE, reverse: false */ };
        // this is naturally paged because every update calls another update in the end
        // until all update pages are loaded
        return socket.send('/auth/kegs/db/query', {
            kegDbId: this.kegDb.id,
            type: 'file',
            filter,
            options
        }, false);
    }

    cacheOnceVerified = (file, keg) => {
        file.onceVerified(() => {
            this.cache.setValue(file.fileId, keg);
        });
    }

    updateFiles = async () => {
        if (this.updating || (this.loaded && this.knownUpdateId === this.maxUpdateId)) return;
        console.log(`Proceeding to file update. Known collection version: ${this.knownUpdateId}`);

        if (!this.loaded) {
            performance.mark(`start loading files ${this.id}`);
            this.loading = true;
        }
        this.updating = true;

        if (!this.cache) {
            this.cache = new config.CacheEngine(`${getUser().username}_file_store_${this.id}`, 'props.fileId');
            await this.cache.open();
        }

        let dirty = false;
        let resp;
        if (this.cacheLoaded) {
            resp = await retryUntilSuccess(
                () => this.getFileKegsFromServer(),
                `Updating file list for ${this.id}`);
        } else {
            resp = { kegs: await this.cache.getAllValues(), hasMore: true };
            this.cacheLoaded = true;
        }
        runInAction(() => {
            for (const keg of resp.kegs) {
                if (keg.collectionVersion > this.knownUpdateId) {
                    this.knownUpdateId = keg.collectionVersion;
                }
                if (keg.collectionVersion > this.maxUpdateId) {
                    this.maxUpdateId = keg.collectionVersion;
                }
                if (!keg.props.fileId && !keg.deleted) {
                    if (keg.version > 1) {
                        // this is not normal, kegs with version > 1 should have fileId or should be deleted
                        console.error('File keg missing fileId', keg.kegId);
                    }
                    // this is normal, keg version 1
                    continue;
                }
                const existing = this.fileMap[keg.props.fileId] || this.getByKegId(keg.kegId);
                const file = existing || new File(this.kegDb, this);
                if (keg.deleted) {
                    // deleted keg that exists gets wiped from store and cache
                    if (existing) {
                        this.files.remove(existing);
                        this.cache.removeValue(existing.fileId);
                    }
                    // if it didn't exist, normally it's not in the cache too
                    continue;
                }
                // if keg existed in store and got hidden, we remove it from store, bug also will want to update cache
                // we keep hidden kegs in cache for future use
                if (keg.hidden && existing) {
                    this.files.remove(existing);
                }
                // this will deserialize new keg in to new file object or existing file object
                if (!file.loadFromKeg(keg)) {
                    console.error('Failed to load file keg.', keg.kegId);
                    // broken keg, removing from cache
                    if (keg.hidden && existing) {
                        this.cache.removeValue(existing.fileId);
                    }
                    continue;
                } else {
                    // ok, scheduling caching when signature is verified
                    this.cacheOnceVerified(file, keg);
                    // but if keg was hidden we don't want to process it further
                    if (keg.hidden) continue;
                }
                // existing keg data got updated earlier
                // otherwise we insert it into the store
                if (!existing) {
                    dirty = true;
                    this.files.push(file);
                    if (this.onFileAdded) {
                        this.onFileAdded(keg, file);
                    }
                }
            }
            // in a series of calls, when we got results count less then page size - we've loaded all files
            if (!resp.hasMore && !this.loaded) {
                window.performance.mark(`end loading files ${this.id}`); // eslint-ignore-line
                window.performance.measure(
                    `loading files ${this.id}`,
                    `start loading files ${this.id}`,
                    `end loading files ${this.id}`); // eslint-ignore-line

                this.loaded = true;
                this.loading = false;
                tracker.onUpdated(this.onFileDigestUpdate);
                tracker.subscribeToKegUpdates(this.kegDb.id, 'file', this.onFileDigestUpdate);
                socket.onDisconnect(() => { this.updatedAfterReconnect = false; });
            }
            this.updating = false;
            // keep the paging going
            setTimeout(this.onFileDigestUpdate);
            // this is kinda true, because if there's more then 1 page of updates it's not really true
            // but his flag is for UI indication only so it's fine
            this.updatedAfterReconnect = true;
            tracker.seenThis(this.kegDb.id, 'file', this.knownUpdateId);
            if (this.onAfterUpdate) {
                this.onAfterUpdate(dirty);
            }
        });
    };
    // #endregion
}

module.exports = FileStoreBase;
