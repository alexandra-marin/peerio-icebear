import { observable, action, runInAction, computed } from 'mobx';
import socket from '../../network/socket';
import File from './file';
import tracker from '../update-tracker';
import _ from 'lodash';
import { retryUntilSuccess } from '../../helpers/retry';
import createMap from '../../helpers/dynamic-array-map';
import FileStoreFolders from './file-store.folders';
import { getUser } from '../../helpers/di-current-user';
import { getFileStore } from '../../helpers/di-file-store';
import config from '../../config';

const PAGE_SIZE = 100;
function isFileSelected(file) {
    return file.selected;
}

function isSelectedFileShareable(file) {
    return !file.selected ? true : file.canShare;
}

class FileStoreBase {
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
    @observable cacheLoaded = false;
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
    @computed
    get allFiles() {
        let ret = this.files;
        if (this.isMainStore) {
            FileStoreBase.instances.forEach(store => {
                ret = ret.concat(store.files.slice());
            });
        }
        return ret;
    }

    // Subset of files not currently hidden by any applied filters
    @computed
    get filesSearchResult() {
        if (!this.searchQuery) return [];
        const q = this.searchQuery.toUpperCase();
        return this.allFiles.filter(f => f.normalizedName.includes(q));
    }

    // Subset of folders not currently hidden by any applied filters
    @computed
    get foldersSearchResult() {
        if (!this.searchQuery) return [];
        return this.foldersFiltered(this.searchQuery);
    }

    foldersFiltered = query => {
        const q = query.toUpperCase();
        return this.folderStore.root.allFolders.filter(f => f.normalizedName.includes(q));
    };

    // Subset of files and folders not currently hidden by any applied filters
    @computed
    get filesAndFoldersSearchResult() {
        return this.foldersSearchResult.concat(this.filesSearchResult);
    }

    @computed
    get hasSelectedFiles() {
        return this.allFiles.some(isFileSelected);
    }

    @computed
    get hasSelectedFilesOrFolders() {
        return this.selectedFilesOrFolders.length;
    }

    @computed
    get canShareSelectedFiles() {
        return this.hasSelectedFiles && this.allFiles.every(isSelectedFileShareable);
    }
    // Returns currently selected files (file.selected == true)
    @computed
    get selectedFiles() {
        return this.allFiles.filter(isFileSelected);
    }

    // Returns currently selected folders (folder.selected == true)
    get selectedFolders() {
        return getFileStore().folderStore.selectedFolders;
    }

    @computed
    get selectedFilesOrFolders() {
        return this.selectedFolders.concat(this.selectedFiles);
    }

    // #endregion

    // #region functions and actions
    /**
     * Finds file in user's drive by fileId. Creates a mobx subscription.
     */
    getById(fileId: string): File | null {
        return this.fileMapObservable.get(fileId);
    }
    /**
     * Finds file in user's drive by kegId. This is not used often, only to detect deleted descriptor and remove file
     * from memory, since deleted keg has no props to link it to the file.
     */
    getByKegId(kegId: string): File {
        return this.files.find(f => f.id === kegId);
    }

    getFilesSharedBy(username: string) {
        return this.files.filter(f => f.owner === username);
    }

    // Deselects all files and folders
    @action
    clearSelection() {
        this.selectedFilesOrFolders.forEach(f => {
            f.selected = false;
        });
    }

    // Deselects unshareable files
    @action
    deselectUnshareableFiles() {
        this.selectedFilesOrFolders.forEach(f => {
            if (f.canShare) return;
            f.selected = false;
        });
    }
    // #endregion

    // #region Files update logic
    _onFileDigestUpdate = () => {
        const digest = tracker.getDigest(this.kegDb.id, 'file');
        // this.unreadFiles = digest.newKegsCount;
        if (this.loaded && digest.maxUpdateId === this.knownUpdateId) {
            this.updatedAfterReconnect = true;
            return;
        }
        this.maxUpdateId = digest.maxUpdateId;
        this.updateFiles();
    };

    onFileDigestUpdate = _.debounce(this._onFileDigestUpdate, 700, {
        leading: true,
        maxWait: 1500
    });

    async getFileKegsFromServer() {
        const filter = { collectionVersion: { $gt: this.knownUpdateId } };
        if (!this.loaded) {
            filter.deleted = false;
        }
        const options = { count: PAGE_SIZE /* , reverse: false */ };
        // this is naturally paged because every update calls another update in the end
        // until all update pages are loaded
        return socket.send(
            '/auth/kegs/db/query',
            {
                kegDbId: this.kegDb.id,
                type: 'file',
                filter,
                options
            },
            false
        );
    }

    verifyCacheObjectUpdate(oldKeg, newKeg) {
        // new cache item, just save
        if (!oldKeg) return newKeg;
        const oldDesc = oldKeg.props.descriptor;
        const newDesc = newKeg.props.descriptor;
        let correctDescriptor = newDesc || oldDesc;
        if (oldDesc && newDesc && oldDesc.collectionVersion > newDesc.collectionVersion) {
            correctDescriptor = oldDesc;
        }
        let correctKeg = newKeg || oldKeg;
        if (oldKeg.collectionVersion > newKeg.collectionVersion) {
            correctKeg = oldKeg;
        }
        correctKeg.props.descriptor = correctDescriptor;

        return correctKeg;
    }

    processCacheUpdateError(err) {
        console.error(err);
    }

    cacheOnceVerified = (file, keg) => {
        file.onceVerified(() => {
            this.cache
                .setValue(keg.kegId, keg, this.verifyCacheObjectUpdate)
                .catch(this.processCacheUpdateError);
        });
    };

    async cacheDescriptor(d) {
        const file = this.getById(d.fileId);
        if (!file) return null;
        const cached = await this.cache.getValue(file.id);
        if (!cached) {
            console.error('cacheDescriptor was called, but cached keg not found');
            return null;
        }
        if (cached.props.descriptor && cached.props.descriptor.version >= d.version) return null;
        cached.props.descriptor = d;
        return this.cache
            .setValue(file.id, cached, this.verifyCacheObjectUpdate)
            .catch(this.processCacheUpdateError);
    }

    // TODO: flags are a bit of a mess, maybe simplify and refactor consumer code
    // updating - any time kegs are being loaded from cache or server
    // loading - initial keg list load in progress (from cache + from server)
    // loaded - initial keg list loaded and now we only update
    // cacheLoaded - kegs from cache loaded (but might still be 'loading' from server)
    updateFiles = async () => {
        if (this.updating || (this.loaded && this.knownUpdateId === this.maxUpdateId)) return;
        console.log(`Proceeding to file update. Known collection version: ${this.knownUpdateId}`);

        if (!this.loaded && !this.loading) {
            performance.mark(`start loading files ${this.id}`);
            this.loading = true;
        }
        this.updating = true;

        // creating cache storage object
        if (!this.cache) {
            this.cache = new config.CacheEngine(`file_store_${this.id}`, 'kegId');
            await this.cache.open();
        }

        let fromCache = false; // current cycle is from cache
        let dirty = false; // wether or not files were added in this cycle
        let resp;

        // get kegs from cache or server
        if (this.cacheLoaded) {
            resp = await retryUntilSuccess(
                () => this.getFileKegsFromServer(),
                `Updating file list for ${this.id}`
            );
        } else {
            performance.mark(`start loading files cache ${this.id}`);
            resp = { kegs: await this.cache.getAllValues(), hasMore: true };
            this.cacheLoaded = true;
            fromCache = true;
        }
        console.log(
            `file store ${this.id} got ${resp.kegs.length} kegs from ${
                fromCache ? 'cache' : 'server'
            }`
        );
        // process kegs
        runInAction(async () => {
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
                //  no point wasting time looking up existing kegs when we load from cache
                const existing = fromCache
                    ? null
                    : this.fileMap[keg.props.fileId] || this.getByKegId(keg.kegId);
                if (keg.deleted || keg.hidden) {
                    // deleted keg that exists gets wiped from store and cache
                    if (existing) {
                        this.files.remove(existing);
                    }
                    this.cache.removeValue(keg.kegId);
                    continue;
                }
                const file = existing || new File(this.kegDb, this);
                // this will deserialize new keg in to new file object or existing file object
                if (!(await file.loadFromKeg(keg, fromCache))) {
                    console.error('Failed to load file keg.', keg.kegId);
                    // broken keg, removing from store and cache
                    if (existing) {
                        this.files.remove(existing);
                    }
                    this.cache.removeValue(keg.kegId);
                    continue;
                }

                if (!fromCache) {
                    // scheduling caching when signature is verified, unless we process cached keg
                    this.cacheOnceVerified(file, keg);
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
            if (fromCache) {
                performance.mark(`stop loading files cache ${this.id}`);
                performance.measure(
                    `loading files cache ${this.id}`,
                    `start loading files cache ${this.id}`,
                    `stop loading files cache ${this.id}`
                );
            }
            // in a series of calls, when we got results count less then page size - we've loaded all files
            if (!resp.hasMore && !this.loaded) {
                performance.mark(`stop loading files ${this.id}`);
                performance.measure(
                    `loading files ${this.id}`,
                    `start loading files ${this.id}`,
                    `stop loading files ${this.id}`
                );

                this.loaded = true;
                this.loading = false;
                tracker.onUpdated(this.onFileDigestUpdate);
                tracker.subscribeToKegUpdates(this.kegDb.id, 'file', this.onFileDigestUpdate);
                socket.onDisconnect(() => {
                    this.updatedAfterReconnect = false;
                });
            }
            this.updating = false;
            // keep the paging going
            if (fromCache || resp.kegs.length > 0) setTimeout(this._onFileDigestUpdate);
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

export default FileStoreBase;
