const { observable, action, when, computed } = require('mobx');
const socket = require('../../network/socket');
const User = require('../user/user');
const File = require('./file');
const warnings = require('../warnings');
const tracker = require('../update-tracker');
const TinyDb = require('../../db/tiny-db');
const config = require('../../config');
const { retryUntilSuccess, isRunning } = require('../../helpers/retry');
const TaskQueue = require('../../helpers/task-queue');
const { setFileStore } = require('../../helpers/di-file-store');
const { getChatStore } = require('../../helpers/di-chat-store');
const { getVolumeStore } = require('../../helpers/di-volume-store');
const FileStoreMigration = require('./file-store.migration');
const errorCodes = require('../../errors').ServerError.codes;
const FileStoreBase = require('./file-store-base');
const FileStoreBulk = require('./file-store.bulk');
const util = require('../../util');
const { asPromise } = require('../../helpers/prombservable');
const _ = require('lodash');

class FileStore extends FileStoreBase {
    isMainStore = true;
    constructor() {
        super(null, null, 'main');
        this.bulk = new FileStoreBulk(this);
        this.migration = new FileStoreMigration(this);
        // currently gets updated by each chat.file-handler inside 'copyKegs()'
        // not very intuitive, but until we make a special file store for chats it works
        this.chatFileMap = observable.map();

        when(() => this.allStoresLoaded, this.onFinishLoading);
    }

    // Human readable maximum auto-expandable inline image size limit
    inlineImageSizeLimitFormatted = util.formatBytes(config.chat.inlineImageSizeLimit);
    // Human readable maximum cutoff inline image size limit
    inlineImageSizeLimitCutoffFormatted = util.formatBytes(config.chat.inlineImageSizeLimitCutoff);

    uploadQueue = new TaskQueue(1);
    migrationQueue = new TaskQueue(1);

    @computed
    get allStoresLoaded() {
        return (
            this.loaded &&
            getVolumeStore().loaded &&
            FileStoreBase.instances.values().every(s => s.loaded)
        );
    }

    @computed
    get isEmpty() {
        return !this.files.length && !this.folderStore.root.folders.length;
    }

    updateDescriptors = _.debounce(
        () => {
            console.log('Updating descriptors');
            const taskId = 'updating descriptors';
            if (isRunning(taskId)) return;
            if (!this.knownDescriptorVersion) {
                this.knownDescriptorVersion = tracker.fileDescriptorDigest.knownUpdateId;
            }

            if (this.knownDescriptorVersion >= tracker.fileDescriptorDigest.maxUpdateId) return;
            const maxUpdateIdBefore = tracker.fileDescriptorDigest.maxUpdateId;
            const opts = this.knownDescriptorVersion
                ? { minCollectionVersion: this.knownDescriptorVersion }
                : undefined;
            retryUntilSuccess(() => socket.send('/auth/file/ids/fetch', opts, false), taskId).then(
                async resp => {
                    await Promise.map(resp, fileId => {
                        const file = this.getAnyById(fileId);
                        if (!file) return Promise.resolve();
                        return socket
                            .send('/auth/file/descriptor/get', { fileId }, false)
                            .then(async d => {
                                if (!file.format) {
                                    // time to migrate keg
                                    file.format = file.latestFormat;
                                    file.descriptorKey = file.blobKey;
                                    file.deserializeDescriptor(d);
                                    this.migrationQueue.addTask(() => file.saveToServer());
                                } else {
                                    file.deserializeDescriptor(d);
                                }
                                if (this.knownDescriptorVersion < d.collectionVersion) {
                                    this.knownDescriptorVersion = d.collectionVersion;
                                }
                                if (this.isMainStore) {
                                    await this.cacheDescriptor(d);
                                }
                                for (const store of this.getFileStoreInstances()) {
                                    await store.cacheDescriptor(d);
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
                    this.descriptorsCache.setValue(
                        'knownDescriptorVersion',
                        {
                            key: 'knownDescriptorVersion',
                            value: this.knownDescriptorVersion
                        },
                        (oldVal, newVal) => {
                            if (!oldVal) return newVal;
                            if (oldVal.value >= newVal.value) return false;
                            return newVal;
                        }
                    );
                    if (this.knownDescriptorVersion < tracker.fileDescriptorDigest.maxUpdateId)
                        this.updateDescriptors();
                }
            );
        },
        1500,
        { leading: true, maxWait: 3000 }
    );

    @action.bound
    onFileAdded(keg, file) {
        if (!file.format) {
            if (file.fileOwner === User.current.username) {
                file.migrating = true;
                file.format = file.latestFormat;
                file.descriptorKey = file.blobKey;
                console.log(`migrating file ${file.fileId}`);
                this.migrationQueue.addTask(() =>
                    retryUntilSuccess(
                        () => {
                            return (keg.props.descriptor
                                ? Promise.resolve()
                                : file.createDescriptor()
                            )
                                .then(() => file.saveToServer())
                                .then(() => {
                                    file.migrating = false;
                                })
                                .catch(err => {
                                    if (err && err.error === errorCodes.malformedRequest) {
                                        // our other connected client managed to migrate this first
                                        file.migrating = false;
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(err);
                                });
                        },
                        `migrating file ${file.fileId}`,
                        10
                    ).catch(err => {
                        file.format = 0;
                        file.migrating = false;
                        console.error(err);
                        console.error(`Failed to migrate file ${file.fileId}`);
                    })
                );
            } else if (keg.props.descriptor) {
                // file owner migrated it, we can migrate our keg
                file.format = file.latestFormat;
                file.descriptorKey = file.blobKey;
                this.migrationQueue.addTask(() =>
                    retryUntilSuccess(() => file.saveToServer(), null, 2)
                );
            }
        }
    }

    @action.bound
    async onFinishLoading() {
        this.resumeBrokenDownloads();
        this.resumeBrokenUploads();
        this.detectCachedFiles();
        socket.onAuthenticated(() => {
            setTimeout(() => {
                if (socket.authenticated) {
                    this.resumeBrokenDownloads();
                    this.resumeBrokenUploads();
                }
            }, 1000);
            for (let i = 0; i < this.files.length; i++) {
                if (this.files[i].cachingFailed) {
                    this.files[i].cachingFailed = false;
                }
            }
        });

        this.descriptorsCache = new config.CacheEngine('file_store_meta', 'key');
        await this.descriptorsCache.open();
        const known = await this.descriptorsCache.getValue('knownDescriptorVersion');
        if (known) {
            this.knownDescriptorVersion = known.value;
        }
        tracker.subscribeToFileDescriptorUpdates(() => {
            const d = tracker.fileDescriptorDigest;
            if (d.knownUpdateId >= d.maxUpdateId) return;
            this.updateDescriptors();
        });
        this.updateDescriptors();
    }

    onAfterUpdate(dirty) {
        if (dirty) {
            this.resumeBrokenDownloads();
            this.resumeBrokenUploads();
        }
    }

    /**
     * Finds all loaded file kegs by fileId
     *
     */
    getAllById(fileId) {
        const files = [];
        const personal = this.getById(fileId);
        if (personal && personal.loaded && !personal.deleted && personal.version > 1) {
            files.push(personal);
        }
        this.chatFileMap.forEach(fileMap => {
            fileMap.forEach((file, id) => {
                if (id === fileId && file.loaded && !file.deleted && file.version > 1) {
                    files.push(file);
                }
            });
        });

        FileStoreBase.instances.forEach(store => {
            const f = store.getById(fileId);
            if (f) files.push(f);
        });
        return files;
    }
    getAnyById(fileId) {
        // looking in SELF
        const personal = this.getById(fileId);
        if (personal && personal.loaded && !personal.deleted && personal.version > 1) {
            return personal;
        }
        // looking in volumes
        let found;
        FileStoreBase.instances.values().every(store => {
            found = store.getById(fileId);
            return !found;
        });
        if (found) return found;

        // looking in chats
        this.chatFileMap.values().every(fileMap => {
            fileMap.values().every(file => {
                if (file.id === fileId && file.loaded && !file.deleted && file.version > 1) {
                    found = file;
                    return false;
                }
                return true;
            });
            return !found;
        });
        return found;
    }

    loadRecentFilesForChat(kegDbId) {
        return retryUntilSuccess(
            () =>
                socket.send(
                    '/auth/kegs/db/list-ext',
                    {
                        kegDbId,
                        options: {
                            type: 'file',
                            reverse: true,
                            count: config.recentFilesDisplayLimit
                        },
                        filter: {
                            deleted: false
                        }
                    },
                    false
                ),
            `loading recent files for ${kegDbId}`,
            10
        ).then(async resp => {
            for (const keg of resp.kegs) {
                if (keg.deleted || keg.hidden) {
                    console.log(
                        'Hidden or deleted file kegs should not have been returned by server.',
                        keg.kegId
                    );
                    continue;
                }
                const chat = getChatStore().chatMap[kegDbId];
                if (!chat) continue;
                const file = new File(chat.db, this);
                if (await file.loadFromKeg(keg)) {
                    if (!file.fileId) {
                        if (file.version > 1) console.error('File keg missing fileId', file.id);
                        // we can get a freshly created keg, it's not a big deal
                        continue;
                    }
                    this.setChatFile(kegDbId, file);
                } else {
                    console.error('Failed to load file keg in chat.', keg.kegId, kegDbId);
                    continue;
                }
            }
        });
    }

    getCachedRecentFilesForChat(kegDbId) {
        const fileMap = this.chatFileMap.get(kegDbId);
        if (!fileMap) {
            return [];
        }
        const ret = fileMap
            .values()
            .filter(f => f.loaded && !f.deleted)
            .sort((f1, f2) => {
                if (f1.kegCreatedAt > f2.kegCreatedAt) return -1;
                if (f1.kegCreatedAt < f2.kegCreatedAt) return 1;
                return 0;
            });
        if (ret.length > config.chat.recentFilesDisplayLimit)
            ret.length = config.chat.recentFilesDisplayLimit;
        return ret;
    }

    /**
     * Returns file shared in specific chat. Loads it if needed.
     * @param {string} fileId
     * @param {string} kegDbId
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

    async loadKegByFileId(fileId) {
        try {
            const file = new File(this.kegDb, this);
            file.fileId = fileId;
            const resp = await retryUntilSuccess(
                () => {
                    return socket.send(
                        '/auth/kegs/db/query',
                        {
                            kegDbId: this.kegDb.id,
                            type: 'file',
                            filter: { fileId }
                        },
                        false
                    );
                },
                undefined,
                3
            );
            if (!resp || !resp.kegs[0] || !(await file.loadFromKeg(resp.kegs[0]))) {
                return null;
            }
            if (file.deleted) {
                return null;
            }
            return file;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    setChatFile(kegDbId, file) {
        let fileMap = this.chatFileMap.get(kegDbId);
        if (!fileMap) {
            fileMap = observable.map();
            this.chatFileMap.set(kegDbId, fileMap);
        }
        const existing = fileMap.get(file.fileId);
        if (existing && existing.version < file.version) {
            return;
        }
        fileMap.set(file.fileId, file);
    }

    // TODO: i think this will do parallel loading with chat.file-handler of newly shared files
    loadChatFile(fileId, kegDbId) {
        const chat = getChatStore().chatMap[kegDbId];
        if (!chat) {
            const file = new File();
            file.fileId = fileId;
            file.deleted = true; // maybe not really, but it's the best option for now
            return file;
        }
        const file = new File(chat.db, this);
        file.fileId = fileId;
        setTimeout(() => {
            this.setChatFile(kegDbId, file);
            retryUntilSuccess(
                () => {
                    return socket.send(
                        '/auth/kegs/db/query',
                        {
                            kegDbId: chat.id,
                            type: 'file',
                            filter: { fileId }
                        },
                        false
                    );
                },
                undefined,
                5
            )
                .then(async resp => {
                    if (!resp.kegs[0]) {
                        await asPromise(this, 'loaded', true);
                        // might be an unmigrated file (keg not created in chat db yet)
                        const personalFile = this.getById(fileId);
                        if (personalFile && personalFile.isLegacy) {
                            // kinda hacky, but this keg is supposed to be used in a very limited scope (download)
                            file.unmigrated = true;
                            Object.assign(file, personalFile);
                            return;
                        }
                    }
                    if (!resp.kegs[0] || !(await file.loadFromKeg(resp.kegs[0]))) {
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
    updateCachedChatKeg(chatId, keg) {
        const map = this.chatFileMap.get(chatId);
        if (!map) return;
        this.setChatFile(chatId, keg);
    }

    /**
     * Uploads a folder reconstructing folder structure in Peerio
     * @param {{
     *           name: 'folderName',
     *           files: ['path', ...],
     *           folders: [same object recursively]
     *        }} tree - folder tree info
     * @param {FileFolder} folder - existing folder to attach uploading folder to
     */
    async uploadFolder(tree, folder) {
        const uploadOneLevel = (folders, parent) => {
            // we received a list of folder and we iterate them
            Promise.map(folders, f => {
                // we create the next folder in list
                const newParent = parent.createFolder(f.name, null, true);
                // we upload files in the folder
                f.files.forEach(file => this.upload(file, null, newParent));
                // we recursively upload folders in this folder
                return uploadOneLevel(f.folders, newParent);
            });
        };

        await uploadOneLevel([tree], folder || this.folderStore.root);
        return folder ? folder.store.folderStore.save() : this.folderStore.save();
    }

    /**
     * Start new file upload and get the file keg for it.
     * @param {string} filePath - full path with name
     * @param {string} [fileName] - if u want to override name in filePath
     * @param {FileFolder} [folder] - where to put the file
     */
    upload = (filePath, fileName, folder) => {
        const keg = new File(User.current.kegDb, this);
        keg.generateFileId();
        // if user uploads to main store folder - we place the file there
        // otherwise place it in the root of main store and then copy to volume

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

                const disposer = when(
                    () => keg.deleted,
                    () => {
                        this.files.remove(keg);
                    }
                );
                when(
                    () => keg.readyForDownload,
                    () => {
                        disposer();
                    }
                );
                // move file into folder as soon as we have file id
                // it will either move it to local folder or volume
                if (folder) {
                    when(() => keg.version > 1, () => folder.attach(keg));
                }
                return ret;
            });
        });

        return keg;
    };

    /**
     * Resumes interrupted downloads if any.
     */
    resumeBrokenDownloads() {
        if (!this.loaded) return;
        console.log('Checking for interrupted downloads.');
        const regex = /^DOWNLOAD:(.*)$/;
        TinyDb.user.getAllKeys().then(keys => {
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
     */
    resumeBrokenUploads() {
        console.log('Checking for interrupted uploads.');
        const regex = /^UPLOAD:(.*)$/;
        TinyDb.user.getAllKeys().then(keys => {
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
                config.FileStream.exists(file.cachePath).then(v => {
                    file.cached = !!v;
                });
            }
            c--;
            setTimeout(checkFile);
        };
        checkFile();
    }
}

const ret = new FileStore();
setFileStore(ret);
module.exports = ret;
