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
const { getContactStore } = require('../../helpers/di-contact-store');
const createMap = require('../../helpers/dynamic-array-map');
const FileStoreFolders = require('./file-store.folders');
const FileStoreBulk = require('./file-store.bulk');
const cryptoUtil = require('../../crypto/util');
const cryptoKeys = require('../../crypto/keys');
const { asPromise } = require('../../helpers/prombservable');

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
        this.bulk = new FileStoreBulk(this);

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

    @observable migrationPending = false;
    @observable migrationStarted = false;
    @observable migrationProgress = 0;
    @observable migrationPerformedByAnotherClient = false;
    @observable.shallow legacySharedFiles = null;

    discardMigrationDisconnectListener = null;

    @computed get hasLegacySharedFiles() {
        return !!(this.legacySharedFiles && this.legacySharedFiles.length);
    }

    get migrationKeg() {
        return User.current.accountVersionKeg;
    }
    confirmMigration = async () => {
        if (this.migrationStarted || this.migrationKeg.accountVersion === 1) return;
        this.migrationStarted = true;
        await asPromise(this, 'loaded', true);
        await asPromise(getChatStore(), 'loaded', true);
        if (this.migrationKeg.accountVersion === 1) return;
        await retryUntilSuccess(() => {
            return this.migrationKeg.save(() => {
                this.migrationKeg.migration = { files: this.legacySharedFiles };
            }).catch(err => {
                console.error(err);
                if (this.socket.authenticated) {
                    // concurrency issue
                    if (this.migrationKeg.accountVersion === 1) return Promise.resolve();
                    this.legacySharedFiles = this.migrationKeg.migration.files;
                    return Promise.resolve();
                }
                return Promise.reject(err);
            });
        });
        this.doMigrate();
    }
    async migrateToAccountVersion1() {
        if (this.migrationKeg.accountVersion === 1) return;

        if (!await this.canStartMigration()) {
            console.log('Migration is perfomed by another client');
            this.migrationPending = true;
            this.migrationPerformedByAnotherClient = true;
            this.migrationStarted = false;
            this.pause();
            // Handle the case when another client disconnects during migration.
            const unsubscribe = socket.subscribe(socket.APP_EVENTS.fileMigrationUnlocked, async () => {
                unsubscribe();
                console.log('Received file migration unlocked event from server');
                // Migrated?
                try {
                    await this.migrationKeg.reload();
                } catch (ex) {
                    // ignore error
                }

                this.migrationPending = false;
                this.migrationPerformedByAnotherClient = false;

                if (this.migrationKeg.accountVersion === 1) {
                    this.resume();
                    return;
                }
                // Not migrated, try to take over the migration.
                console.log('Taking over migration');
                this.migrateToAccountVersion1();
            });
            // Handle the case when another client finishes migration.
            when(() => this.migrationKeg.accountVersion === 1, () => {
                unsubscribe();
                this.migrationPending = false;
                this.migrationPerformedByAnotherClient = false;
                this.resume();
            });
            return;
        }

        if (this.paused) {
            this.resume();
        }
        this.discardMigrationDisconnectListener = socket.onDisconnect(() => {
            this.discardMigrationDisconnectListener();
            this.discardMigrationDisconnectListener = null;
            socket.onceAuthenticated(() => {
                this.migrateToAccountVersion1();
            });
        });
        this.migrationPending = true;
        this.migrationPerformedByAnotherClient = false;
        await retryUntilSuccess(() => this.getLegacySharedFiles());
        if (this.migrationKeg.migration.files) {
            this.legacySharedFiles = this.migrationKeg.migration.files;
            this.migrationStarted = true;
            this.doMigrate();
        }
        when(() => this.migrationKeg.accountVersion === 1, this.stopMigration);
    }

    @action.bound async stopMigration() {
        if (this.discardMigrationDisconnectListener) {
            this.discardMigrationDisconnectListener();
            this.discardMigrationDisconnectListener = null;
        }
        await this.finishMigration();
        this.migrationPending = false;
        this.migrationStarted = false;
        this.migrationPerformedByAnotherClient = false;
        this.migrationProgress = 100;
    }

    /**
     * Asks server if we can start migration.
     * @returns {Promise<boolean>}
     * @private
     */
    canStartMigration() {
        return retryUntilSuccess(() => socket.send('/auth/file/migration/start'))
            .then(res => res.success);
    }

    /**
     * Tells server that migration is finished.
     * @private
     */
    finishMigration() {
        if (this.migrationPerformedByAnotherClient) return Promise.resolve();
        console.log('Sending /auth/file/migration/finish');
        return retryUntilSuccess(() => socket.send('/auth/file/migration/finish'));
    }

    async doMigrate() {
        await asPromise(this, 'loaded', true);
        await asPromise(getChatStore(), 'loaded', true);

        /* eslint-disable no-await-in-loop */
        for (let i = 0; i < this.legacySharedFiles.length; i++) {
            if (!this.migrationPending) return; // it was ended externally
            this.migrationProgress = Math.floor(i / (this.legacySharedFiles.length / 100));
            const item = this.legacySharedFiles[i];
            console.log('migrating', item);
            // verify file
            const file = this.getById(item.fileId);
            if (!file) {
                console.error(`File ${item.fileId} not found, can't migrate`);
                continue;
            }
            if (!file.format || file.migrating) {
                await asPromise(file, 'migrating', false);
            }
            if (!file.format) {
                console.error(`File ${item.fileId} is invalid, can't migrate`);
                continue;
            }
            // this will be a share in DM
            if (item.username) {
                // load and verify contact
                const contact = getContactStore().getContact(item.username);
                await contact.ensureLoaded();
                if (contact.notFound) {
                    console.error(`Contact ${item.username} not found can't share ${item.fileId}`);
                    continue;
                }
                if (contact.isDeleted) {
                    console.error(`Contact ${item.username} deleted can't share ${item.fileId}`);
                    continue;
                }
                // load and verify DM
                let chat = null;
                await retryUntilSuccess(() => {
                    chat = getChatStore().startChat([contact], false, '', '', true);
                    return chat.loadMetadata();
                }, null, 10)
                    .catch(() => {
                        console.error(`Can't create DM with ${item.username} to share ${item.fileId}`);
                    });
                if (!chat || !chat.metaLoaded) {
                    continue;
                }
                // share (retry is inside)
                await file.share(chat).catch(err => {
                    console.error(err);
                    console.error(`Failed to share ${item.fileId}`);
                });
                continue;
            } else if (item.kegDbId) {
                getChatStore().addChat(item.kegDbId, true);
                if (!getChatStore().chatMap[item.kegDbId]) {
                    console.error(`Failed to load room ${item.kegDbId}`);
                    continue;
                }
                const chat = getChatStore().chatMap[item.kegDbId];
                await chat.loadMetadata().catch(err => {
                    console.error(err);
                    console.error(`Failed to load room ${item.kegDbId}`);
                });
                if (!chat.metaLoaded) {
                    continue;
                }
                await file.share(chat).catch(err => {
                    console.error(err);
                    console.error(`Failed to share ${item.fileId}`);
                });
            }
        }
        /* eslint-enable no-await-in-loop */
        this.stopMigration();
        this.migrationKeg.save(() => {
            this.migrationKeg.migration.files = [];
            this.migrationKeg.accountVersion = 1;
        });
        warnings.add('title_fileUpdateComplete');
    }

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
     * Initial file list was loaded.
     * @member {boolean}
     * @protected
     */
    @observable loaded = false;
    /**
     * Updates to file store are paused.
     */
    @observable paused = false;
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
     * @member {boolean} hasSelectedFilesOrFolders
     * @memberof FileStore
     * @instance
     * @public
     */
    @computed get hasSelectedFilesOrFolders() {
        return this.selectedFilesOrFolders.length;
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
     * Returns currently selected folders (folder.selected == true)
     * @returns {Array<Folder>}
     * @public
     */
    get selectedFolders() {
        return this.folders.selectedFolders;
    }

    @computed get selectedFilesOrFolders() {
        return this.selectedFolders.slice().concat(this.getSelectedFiles());
    }

    /**
     * Deselects all files and folders
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

        // selectedFolders is computable, do not recalculate it
        const selFolders = this.selectedFolders;
        for (let i = 0; i < selFolders.length; i++) {
            selFolders[i].selected = false;
        }
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
        if (this.paused) return;

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
        if (this.paused) return;

        const digest = tracker.getDigest('SELF', 'file');
        // this.unreadFiles = digest.newKegsCount;
        if (this.loaded && digest.maxUpdateId === this.maxUpdateId) {
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
                    deleted: false,
                    hidden: false
                }
            }),
            'Initial file list loading'
        ).then(action(kegs => {
            for (const keg of kegs.kegs) {
                if (keg.deleted || keg.hidden) {
                    console.log('Hidden or deleted file kegs should not have been returned by server. kegid:', keg.id);
                    continue;
                }
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
                    if (!file.format && file.fileOwner === User.current.username) {
                        file.migrating = true;
                        file.format = file.latestFormat;
                        file.descriptorKey = cryptoUtil.bytesToB64(cryptoKeys.generateEncryptionKey());
                        console.log(`migrating file ${file.fileId}`);
                        retryUntilSuccess(() => {
                            return file.createDescriptor()
                                .then(() => file.saveToServer())
                                .then(() => { file.migrating = false; })
                                .catch(err => {
                                    if (err && err.error === 406) {
                                        // our other connected client managed to migrate this first
                                        file.migrating = false;
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(err);
                                });
                        }, `migrating file ${file.fileId}`, 10)
                            .catch(err => {
                                file.format = 0;
                                file.migrating = false;
                                console.error(err);
                                console.error(`Failed to migrate file ${file.fileId}`);
                            });
                    }
                } else {
                    console.error('Failed to load file keg.', keg.kegId);
                    // trying to be safe performing destructive operation of deleting a corrupted file keg
                    // if (keg.version > 1 && keg.type === 'file'
                    //     && (!keg.createdAt || Date.now() - keg.createdAt > 600000000/* approx 1 week */)) {
                    //     console.log('Removing invalid file keg', keg);
                    //     file.remove();
                    // }
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
        let lastPage = { maxId: '999' };
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
                    if (keg.deleted || keg.hidden) {
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
        setTimeout(() => {
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
        });
        return file;
    }

    removeCachedChatKeg(chatId, kegId) {
        const map = this.chatFileMap.get(chatId);
        if (!map) return;
        for (const f of map.values()) {
            if (f.id === kegId) {
                f.deleted = true;
                return;
            }
        }
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

    // [ { kegDbId: string, fileId: string }, ... ]
    getLegacySharedFiles() {
        if (this.legacySharedFiles) return Promise.resolve(this.legacySharedFiles);
        return socket.send('/auth/file/legacy/channel/list')
            .then(res => {
                this.legacySharedFiles = [];
                if (res) {
                    if (res.sharedInChannels) {
                        Object.keys(res.sharedInChannels).forEach(kegDbId => {
                            res.sharedInChannels[kegDbId].forEach(fileId => {
                                this.legacySharedFiles.push({ kegDbId, fileId });
                            });
                        });
                    }
                    if (res.sharedWithUsers) {
                        Object.keys(res.sharedWithUsers).forEach(fileId => {
                            res.sharedWithUsers[fileId].forEach(username => {
                                this.legacySharedFiles.push({ username, fileId });
                            });
                        });
                    }
                }
                return this.legacySharedFiles;
            });
    }

    async getLegacySharedFilesText() {
        await asPromise(this, 'loaded', true);
        await asPromise(getChatStore(), 'loaded', true);
        await this.getLegacySharedFiles();

        const eol = typeof navigator === 'undefined'
            || !navigator.platform // eslint-disable-line no-undef
            || !navigator.platform.startsWith('Win') // eslint-disable-line no-undef
            ? '\n' : '\r\n';

        let ret = '';
        for (const item of this.legacySharedFiles) {
            let fileName = item.fileId;
            const file = this.getById(item.fileId);
            if (file && file.name) {
                fileName = file.name;
            }
            let recipient = item.username;
            if (!recipient) {
                const chat = getChatStore().chatMap[item.kegDbId];
                if (chat) {
                    await asPromise(chat, 'headLoaded', true); //eslint-disable-line
                    recipient = chat.name;
                } else {
                    recipient = item.kegDbId;
                }
            }
            ret += `${fileName} ; ${recipient}${eol}`;
        }
        return ret;
    }

    /**
     * Pause file store updates.
     * @public
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume file store updates.
     * @public
     */
    resume() {
        this.paused = false;
        setTimeout(() => {
            this.onFileDigestUpdate();
            this.updateDescriptors();
        });
    }
}
const ret = new FileStore();
setFileStore(ret);
module.exports = ret;
