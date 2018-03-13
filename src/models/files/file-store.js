const { observable, action, when, computed } = require('mobx');
const socket = require('../../network/socket');
const User = require('../user/user');
const File = require('./file');
const warnings = require('../warnings');
const tracker = require('../update-tracker');
const TinyDb = require('../../db/tiny-db');
const config = require('../../config');
const util = require('../../util');
const _ = require('lodash');
const { retryUntilSuccess, isRunning } = require('../../helpers/retry');
const TaskQueue = require('../../helpers/task-queue');
const { setFileStore } = require('../../helpers/di-file-store');
const { getChatStore } = require('../../helpers/di-chat-store');
const createMap = require('../../helpers/dynamic-array-map');
const FileStoreFolders = require('./file-store.folders');

/**
 * File store.
 * @namespace
 * @public
 */
class FileStore {
    constructor() {
        const m = createMap(this.files, 'fileId');
        this.fileMap = m.map;
        this.fileMapObservable = m.observableMap;
        this.folders = new FileStoreFolders(this);

        this.chatFileMap = observable.map();

        tracker.subscribeToKegUpdates('SELF', 'file', () => {
            console.log('Files update event received');
            this.onFileDigestUpdate();
        });

        tracker.subscribeToFileDescriptorUpdates(() => {
            const d = tracker.fileDescriptorDigest;
            if (d.knownUpdateId >= d.maxUpdateId) return;
            this.updateDescriptors(d.knownUpdateId);
        });
    }
    /**
     * Full list of user's files.
     * @member {ObservableArray<File>} files
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable.shallow files = [];

    /**
     * Subset of files not currently hidden by any applied filters
     * @readonly
     * @memberof FileStore
     */
    @computed get visibleFiles() {
        return this.files.filter(f => f.show);
    }

    /**
     * Subset of files and folders not currently hidden by any applied filters
     * @readonly
     * @memberof FileStore
     */
    @computed get visibleFilesAndFolders() {
        const folders = this.folders.searchAllFoldersByName(this.currentFilter);
        return folders.concat(this.files.filter(f => f.show));
    }

    /**
     * Filter to apply when computing visible folders
     * @member {string} folderFilter
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable folderFilter = '';

    /**
     * Subset of folders not currently hidden by any applied filters
     * @readonly
     * @memberof FileStore
     */
    @computed get visibleFolders() {
        return this.folders.searchAllFoldersByName(this.folderFilter);
    }

    /**
     * Human readable maximum auto-expandable inline image size limit
     * @readonly
     * @memberof FileStore
     */
    inlineImageSizeLimitFormatted = util.formatBytes(config.chat.inlineImageSizeLimit);

    /**
     * Human readable maximum cutoff inline image size limit
     * @readonly
     * @memberof FileStore
     */
    inlineImageSizeLimitCutoffFormatted = util.formatBytes(config.chat.inlineImageSizeLimitCutoff);

    /**
     * Store is loading full file list for the first time.
     * @member {boolean} loading
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable loading = false;
    /**
     * Will set to true after file list has been updated upon reconnect.
     * @member {boolean} updatedAfterReconnect
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable updatedAfterReconnect = true;
    /**
     * Readonly, shows which keyword was used with last call to `filter()`, this need refactoring.
     * @member {string} currentFilter
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable currentFilter = '';
    /**
     * Initial file list was loaded, this is not observable property.
     * @member {boolean}
     * @protected
     */
    loaded = false;
    /**
     * Currently updating file list from server, this is not observable property.
     * @member {boolean}
     * @public
     */
    updating = false;

    maxUpdateId = '';
    knownUpdateId = '';
    /**
     * Readonly
     * @member {TaskQueue} uploadQueue
     * @public
     */
    uploadQueue = new TaskQueue(1);

    /**
     * @ignore
     * This will go away soon.
     */
    @observable unreadFiles = 0;// tracker.getDigest('SELF', 'file').newKegsCount;

    // optimization to avoid creating functions every time
    static isFileSelected(file) {
        return file.selected;
    }

    // optimization to avoid creating functions every time
    static isSelectedFileShareable(file) {
        return !file.selected ? true : file.canShare;
    }

    // optimization to avoid creating functions every time
    static isFileShareable(file) {
        return file.canShare;
    }

    /**
     * @member {boolean} hasSelectedFiles
     * @memberof FileStore
     * @instance
     * @public
     */
    @computed get hasSelectedFiles() {
        return this.files.some(FileStore.isFileSelected);
    }

    /**
     * @member {boolean} canShareSelectedFiles
     * @memberof FileStore
     * @instance
     * @public
     */
    @computed get canShareSelectedFiles() {
        return this.hasSelectedFiles && this.files.every(FileStore.isSelectedFileShareable);
    }

    /**
     * @member {boolean} allVisibleSelected
     * @memberof FileStore
     * @instance
     * @public
     */
    @computed get allVisibleSelected() {
        for (let i = 0; i < this.files.length; i++) {
            if (!this.files[i].show) continue;
            if (this.files[i].selected === false) return false;
        }
        return true;
    }

    /**
     * @member {number} selectedCount
     * @memberof FileStore
     * @instance
     * @public
     */
    @computed get selectedCount() {
        let ret = 0;
        for (let i = 0; i < this.files.length; i++) {
            if (this.files[i].selected) ret += 1;
        }
        return ret;
    }

    /**
     * Returns currently selected files (file.selected == true)
     * @returns {Array<File>}
     * @public
     */
    getSelectedFiles() {
        const own = this.files.filter(FileStore.isFileSelected);
        if (own.length) return own;
        // TODO: this is temporary, file selection needs to be better, especially with files-in-chats
        const ret = [];
        this.chatFileMap.values().forEach(dbMap => {
            const selected = dbMap.values().filter(FileStore.isFileSelected);
            if (selected.length) ret.push(...selected);
        });
        return ret;
    }

    /**
     * Returns currently selected files that are also shareable.
     * @returns {Array<File>}
     * @public
     */
    getShareableSelectedFiles() {
        return this.files.filter(FileStore.isFileSelectedAndShareable);
    }

    /**
     * Deselects all files
     * @function clearSelection
     * @memberof FileStore
     * @instance
     * @public
     */
    @action clearSelection() {
        for (let i = 0; i < this.files.length; i++) {
            this.files[i].selected = false;
        }
        this.chatFileMap.values().forEach(dbMap => {
            dbMap.values().forEach(f => { f.selected = false; });
        });
    }

    /**
     * Selects all files
     * @function selectAll
     * @memberof FileStore
     * @instance
     * @public
     */
    @action selectAll() {
        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            if (!file.show || !file.readyForDownload) continue;
            this.files[i].selected = true;
        }
    }

    /**
     * Deselects unshareable files
     * @function deselectUnshareableFiles
     * @memberof FileStore
     * @instance
     * @public
     */
    @action deselectUnshareableFiles() {
        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            if (file.canShare) continue;
            if (file.selected) file.selected = false;
        }
    }

    /**
     * Applies filter to files.
     * @function filterByName
     * @param {string} query
     * @memberof FileStore
     * @instance
     * @public
     */
    @action filterByName(query) {
        this.currentFilter = query;
        const regex = new RegExp(_.escapeRegExp(query), 'i');
        for (let i = 0; i < this.files.length; i++) {
            this.files[i].show = regex.test(this.files[i].name);
            if (!this.files[i].show) this.files[i].selected = false;
        }
    }

    /**
     * Resets filter
     * @function clearFilter
     * @memberof FileStore
     * @instance
     * @public
     */
    @action clearFilter() {
        this.currentFilter = '';
        for (let i = 0; i < this.files.length; i++) {
            this.files[i].show = true;
        }
    }

    updateDescriptors() {
        const taskId = 'updating descriptors';
        if (isRunning('taskId')) return;
        if (!this.knownDescriptorVersion) {
            this.knownDescriptorVersion = tracker.fileDescriptorDigest.knownUpdateId;
        }
        if (this.knownDescriptorVersion >= tracker.fileDescriptorDigest.maxUpdateId) return;
        const maxUpdateIdBefore = tracker.fileDescriptorDigest.maxUpdateId;
        const opts = this.knownDescriptorVersion ? { minCollectionVersion: this.knownDescriptorVersion } : undefined;
        retryUntilSuccess(
            () => socket.send('/auth/file/ids/fetch', opts),
            taskId
        ).then(async resp => {
            await Promise.map(resp, fileId => {
                const files = this.getAllById(fileId);
                if (!files.length) return Promise.resolve();
                return socket.send('/auth/file/descriptor/get', { fileId })
                    .then(d => {
                        // todo: optimise, do not repeat decrypt operations
                        files.forEach(f => f.deserializeDescriptor(d));
                        if (this.knownDescriptorVersion < d.collectionVersion) {
                            this.knownDescriptorVersion = d.collectionVersion;
                        }
                    });
            });
            // we might not have loaded all updated descriptors
            // because corresponding files are not loaded (out of scope)
            // so we don't know their individual collection versions
            // but we still need to mark the known version
            if (maxUpdateIdBefore === tracker.fileDescriptorDigest.maxUpdateId) {
                this.knownDescriptorVersion = maxUpdateIdBefore;
            }
            tracker.seenThis(tracker.DESCRIPTOR_PATH, null, this.knownDescriptorVersion);
            if (this.knownDescriptorVersion < tracker.fileDescriptorDigest.maxUpdateId) this.updateDescriptors();
        });
    }

    onFileDigestUpdate = _.throttle(() => {
        const digest = tracker.getDigest('SELF', 'file');
        // this.unreadFiles = digest.newKegsCount;
        if (digest.maxUpdateId === this.maxUpdateId) {
            this.updatedAfterReconnect = true;
            return;
        }
        this.maxUpdateId = digest.maxUpdateId;
        this.updateFiles(this.maxUpdateId);
    }, 1500);

    _getFiles() {
        const filter = this.knownUpdateId ? { minCollectionVersion: this.knownUpdateId } : {};
        // this is naturally paged because every update calls another update in the end
        // until all update pages are loaded
        return socket.send('/auth/kegs/db/list-ext', {
            kegDbId: 'SELF',
            options: {
                type: 'file',
                reverse: false,
                count: 50
            },
            filter
        });
    }

    @action _loadPage(fromKegId) {
        return retryUntilSuccess(
            () => socket.send('/auth/kegs/db/list-ext', {
                kegDbId: 'SELF',
                options: {
                    type: 'file',
                    reverse: false,
                    fromKegId,
                    count: 50
                },
                filter: {
                    deleted: false
                }
            }),
            'Initial file list loading'
        ).then(action(kegs => {
            for (const keg of kegs.kegs) {
                const file = new File(User.current.kegDb);
                if (keg.collectionVersion > this.maxUpdateId) {
                    this.maxUpdateId = keg.collectionVersion;
                }
                if (keg.collectionVersion > this.knownUpdateId) {
                    this.knownUpdateId = keg.collectionVersion;
                }
                if (file.loadFromKeg(keg)) {
                    if (!file.fileId) {
                        console.error('File keg missing fileId', file.id);
                        continue;
                    }
                    if (this.fileMap[file.fileId]) {
                        console.error('File keg has duplicate fileId', file.id);
                        continue;
                    }
                    this.files.unshift(file);
                } else {
                    console.error('Failed to load file keg', keg.kegId);
                    continue;
                }
            }
            const size = kegs.kegs.length;
            return { size, maxId: size > 0 ? kegs.kegs[0].kegId : 0 };
        }));
    }

    @action _finishLoading() {
        this.loading = false;
        this.loaded = true;
        this.resumeBrokenDownloads();
        this.resumeBrokenUploads();
        this.detectCachedFiles();
        socket.onDisconnect(() => { this.updatedAfterReconnect = false; });
        socket.onAuthenticated(() => {
            this.onFileDigestUpdate();
            setTimeout(() => {
                if (socket.authenticated) {
                    this.resumeBrokenDownloads();
                    this.resumeBrokenUploads();
                }
            }, 3000);
            for (let i = 0; i < this.files.length; i++) {
                if (this.files[i].cachingFailed) {
                    this.files[i].cachingFailed = false;
                }
            }
        });
        setTimeout(this.updateFiles);
        tracker.seenThis('SELF', 'file', this.knownUpdateId);
    }

    /**
     * Call at least once from UI.
     * @public
     */
    loadAllFiles = Promise.method(async () => {
        if (this.loading || this.loaded) return;
        this.loading = true;
        let lastPage = { maxId: '1001' };
        do {
            lastPage = await this._loadPage(lastPage.maxId); // eslint-disable-line no-await-in-loop
        } while (lastPage.size > 0);
        this._finishLoading();
    });

    // this essentially does the same as loadAllFiles but with filter,
    // we reserve this way of updating anyway for future, when we'll not gonna load entire file list on start
    updateFiles = (maxId) => {
        if (!this.loaded || this.updating) return;
        if (!maxId) maxId = this.maxUpdateId; // eslint-disable-line
        console.log(`Proceeding to file update. Known collection version: ${this.knownUpdateId}`);
        this.updating = true;
        let dirty = false;
        retryUntilSuccess(() => this._getFiles(), 'Updating file list')
            .then(action(resp => {
                const { kegs } = resp;
                for (const keg of kegs) {
                    if (keg.collectionVersion > this.knownUpdateId) {
                        this.knownUpdateId = keg.collectionVersion;
                    }
                    if (!keg.props.fileId && !keg.deleted) {
                        console.error('File keg missing fileId', keg.kegId);
                        continue;
                    }
                    const existing = this.getById(keg.props.fileId) || this.getByKegId(keg.kegId);
                    const file = existing || new File(User.current.kegDb);
                    if (keg.deleted) {
                        if (existing) this.files.remove(existing);
                        continue;
                    }
                    if (!file.loadFromKeg(keg) || file.isEmpty) continue;
                    if (!existing) {
                        dirty = true;
                        this.files.unshift(file);
                    }
                }
                this.updating = false;
                if (dirty) {
                    this.resumeBrokenDownloads();
                    this.resumeBrokenUploads();
                }
                // need this because if u delete all files knownUpdateId won't be set at all after initial load
                if (this.knownUpdateId < maxId) this.knownUpdateId = maxId;
                // in case we missed another event while updating
                if (kegs.length || (this.maxUpdateId && this.knownUpdateId < this.maxUpdateId)) {
                    setTimeout(this.updateFiles);
                } else {
                    setTimeout(this.onFileDigestUpdate);
                }
                this.updatedAfterReconnect = true;
                tracker.seenThis('SELF', 'file', this.knownUpdateId);
            }));
    };

    /**
     * Finds file in user's drive by fileId.
     * Looks for loaded files only (all of them are loaded normally)
     * @param {string} fileId
     * @returns {?File}
     */
    getById(fileId) {
        return this.fileMapObservable.get(fileId);
    }
    /**
     * Finds file in user's drive by kegId. This is not used often,
     * only to detect deleted descriptor and remove file from memory,
     * since deleted keg has no props to link it to the file.
     * Looks for loaded files only (all of them are loaded normally)
     * @param {string} kegId
     * @returns {?File}
     */
    getByKegId(kegId) {
        return this.files.find(f => f.id === kegId);
    }

    /**
     * Finds all loaded file kegs by fileId
     *
     * @memberof FileStore
     */
    getAllById(fileId) {
        const files = [];
        const personal = this.getById(fileId);
        if (personal && personal.loaded && !personal.deleted && personal.version > 1) {
            files.push(personal);
        }
        this.chatFileMap.forEach((fileMap) => {
            fileMap.forEach((file, id) => {
                if (id === fileId && file.loaded && !file.deleted && file.version > 1) {
                    files.push(file);
                }
            });
        });
        return files;
    }
    /**
     * Returns file shared in specific chat. Loads it if needed.
     * @param {string} fileId
     * @param {string} kegDbId
     * @memberof FileStore
     */
    getByIdInChat(fileId, kegDbId) {
        const fileMap = this.chatFileMap.get(kegDbId);
        if (!fileMap) {
            return this.loadChatFile(fileId, kegDbId);
        }
        const file = fileMap.get(fileId);
        if (!file) {
            return this.loadChatFile(fileId, kegDbId);
        }
        return file;
    }
    loadChatFile(fileId, kegDbId) {
        const chat = getChatStore().chatMap[kegDbId];
        if (!chat) {
            const file = new File();
            file.deleted = true; // maybe not really, but it's the best option for now
            return file;
        }
        const file = new File(chat.db);
        file.fileId = fileId;
        let fileMap = this.chatFileMap.get(kegDbId);
        if (!fileMap) {
            fileMap = observable.map();
            this.chatFileMap.set(kegDbId, fileMap);
        }
        fileMap.set(fileId, file);
        retryUntilSuccess(() => {
            return socket.send('/auth/kegs/db/query', {
                kegDbId: chat.id,
                type: 'file',
                filter: { fileId }
            });
        }, undefined, 5)
            .then(resp => {
                if (!resp.kegs[0] || !file.loadFromKeg(resp.kegs[0])) {
                    file.deleted = true;
                    file.loaded = true;
                }
            })
            .catch(err => {
                console.error('Error loading file from chat', err);
                file.deleted = true;
                file.loaded = true;
            });
        return file;
    }

    /**
     * Start new file upload and get the file keg for it.
     * @function upload
     * @param {string} filePath - full path with name
     * @param {string} [fileName] - if u want to override name in filePath
     * @public
     */
    upload = (filePath, fileName, folderId) => {
        const keg = new File(User.current.kegDb);
        keg.folderId = folderId;
        config.FileStream.getStat(filePath).then(stat => {
            if (!User.current.canUploadFileSize(stat.size)) {
                keg.deleted = true;
                warnings.addSevere('error_fileQuotaExceeded', 'error_uploadFailed');
                return;
            }
            if (!User.current.canUploadMaxFileSize(stat.size)) {
                keg.deleted = true;
                warnings.addSevere('error_fileUploadSizeExceeded', 'error_uploadFailed');
                return;
            }
            this.uploadQueue.addTask(() => {
                const ret = keg.upload(filePath, fileName);
                this.files.unshift(keg);

                const disposer = when(() => keg.deleted, () => {
                    this.files.remove(keg);
                });
                when(() => keg.readyForDownload, () => {
                    disposer();
                });
                // move file into folder as soon as we have file id
                if (folderId) {
                    when(() => keg.fileId, () => this.folders.getById(folderId).moveInto(keg));
                }
                return ret;
            });
        });

        return keg;
    }

    /**
     * Resumes interrupted downloads if any.
     * @protected
     */
    resumeBrokenDownloads() {
        if (!this.loaded) return;
        console.log('Checking for interrupted downloads.');
        const regex = /^DOWNLOAD:(.*)$/;
        TinyDb.user.getAllKeys()
            .then(keys => {
                for (let i = 0; i < keys.length; i++) {
                    const match = regex.exec(keys[i]);
                    if (!match || !match[1]) continue;
                    const file = this.getById(match[1]);
                    if (file) {
                        console.log(`Requesting download resume for ${keys[i]}`);
                        TinyDb.user.getValue(keys[i]).then(dlInfo => file.download(dlInfo.path, true));
                    } else {
                        TinyDb.user.removeValue(keys[i]);
                    }
                }
            });
    }

    /**
     * Resumes interrupted uploads if any.
     * @protected
     */
    resumeBrokenUploads() {
        console.log('Checking for interrupted uploads.');
        const regex = /^UPLOAD:(.*)$/;
        TinyDb.user.getAllKeys()
            .then(keys => {
                for (let i = 0; i < keys.length; i++) {
                    const match = regex.exec(keys[i]);
                    if (!match || !match[1]) continue;
                    const file = this.getById(match[1]);
                    if (file) {
                        console.log(`Requesting upload resume for ${keys[i]}`);
                        TinyDb.user.getValue(keys[i]).then(dlInfo => {
                            return this.uploadQueue.addTask(() => file.upload(dlInfo.path, null, true));
                        });
                    }
                }
            });
    }
    // sets file.cached flag for mobile
    detectCachedFiles() {
        if (!config.isMobile || this.files.length === 0) return;
        let c = this.files.length - 1;
        const checkFile = () => {
            if (c < 0) return;
            const file = this.files[c];
            if (file && !file.downloading) {
                config.FileStream.exists(file.cachePath)
                    .then(v => { file.cached = !!v; });
            }
            c--;
            setTimeout(checkFile);
        };
        checkFile();
    }

    getLegacySharedFiles() {
        if (this.legacySharedFiles) return Promise.resolve(this.legacySharedFiles);
        return socket.send('/auth/file/migration/shares')
            .then(res => {
                this.legacySharedFiles = res;
                return res;
            });
    }
}
const ret = new FileStore();
setFileStore(ret);
module.exports = ret;
