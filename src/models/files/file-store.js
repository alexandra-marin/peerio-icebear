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
const FileStoreMigration = require('./file-store.migration');
const errorCodes = require('../../errors').ServerError.codes;
const FileStoreBase = require('./file-store-base');
const FileStoreBulk = require('./file-store.bulk');
const util = require('../../util');
const { asPromise } = require('../../helpers/prombservable');

class FileStore extends FileStoreBase {
    isMainStore = true;
    constructor() {
        super(null, null, 'main');
        this.bulk = new FileStoreBulk(this);
        this.migration = new FileStoreMigration(this);
        this.chatFileMap = observable.map();

        tracker.subscribeToFileDescriptorUpdates(() => {
            const d = tracker.fileDescriptorDigest;
            if (d.knownUpdateId >= d.maxUpdateId) return;
            this.updateDescriptors(d.knownUpdateId);
        });

        when(() => this.loaded, this.onFinishLoading);
    }

    // Human readable maximum auto-expandable inline image size limit
    inlineImageSizeLimitFormatted = util.formatBytes(config.chat.inlineImageSizeLimit);
    // Human readable maximum cutoff inline image size limit
    inlineImageSizeLimitCutoffFormatted = util.formatBytes(config.chat.inlineImageSizeLimitCutoff);

    uploadQueue = new TaskQueue(1);
    migrationQueue = new TaskQueue(1);

    @computed get isEmpty() {
        return !this.files.length && !this.folderStore.root.folders.length;
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
            () => socket.send('/auth/file/ids/fetch', opts, false),
            taskId
        ).then(async resp => {
            await Promise.map(resp, fileId => {
                const files = this.getAllById(fileId);
                if (!files.length) return Promise.resolve();
                return socket.send('/auth/file/descriptor/get', { fileId }, false)
                    .then(d => {
                        // todo: optimise, do not repeat decrypt operations
                        files.forEach(f => {
                            if (!f.format) {
                                // time to migrate keg
                                f.format = f.latestFormat;
                                f.descriptorKey = f.blobKey;
                                f.deserializeDescriptor(d);
                                this.migrationQueue.addTask(() => f.saveToServer());
                            } else {
                                f.deserializeDescriptor(d);
                            }
                        });
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

    @action.bound onInitialFileAdded(keg, file) {
        if (!file.format) {
            if (file.fileOwner === User.current.username) {
                file.migrating = true;
                file.format = file.latestFormat;
                file.descriptorKey = file.blobKey;
                console.log(`migrating file ${file.fileId}`);
                this.migrationQueue.addTask(() =>
                    retryUntilSuccess(() => {
                        return file.createDescriptor()
                            .then(() => file.saveToServer())
                            .then(() => { file.migrating = false; })
                            .catch(err => {
                                if (err && err.error === errorCodes.malformedRequest) {
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
                        })
                );
            } else if (keg.descriptor) {
                // file owner migrated it, we can migrate our keg
                file.format = file.latestFormat;
                file.descriptorKey = file.blobKey;
                this.migrationQueue.addTask(() => retryUntilSuccess(() => file.saveToServer()));
            }
        }
    }

    @action.bound onFinishLoading() {
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

    onAfterUpdate(dirty) {
        if (dirty) {
            this.resumeBrokenDownloads();
            this.resumeBrokenUploads();
        }
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

        FileStoreBase.instances.forEach(store => {
            const f = store.getById(fileId);
            if (f) files.push(f);
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

    async loadKegByFileId(fileId) {
        try {
            const file = new File(this.kegDb, this);
            const resp = await retryUntilSuccess(() => {
                return socket.send('/auth/kegs/db/query', {
                    kegDbId: this.kegDb.id,
                    type: 'file',
                    filter: { fileId }
                }, false);
            }, undefined, 3);
            if (!resp || !resp.kegs[0] || !file.loadFromKeg(resp.kegs[0])) {
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

    loadChatFile(fileId, kegDbId) {
        const chat = getChatStore().chatMap[kegDbId];
        if (!chat) {
            const file = new File();
            file.deleted = true; // maybe not really, but it's the best option for now
            return file;
        }
        const file = new File(chat.db, this);
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
                }, false);
            }, undefined, 5)
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
     * @function upload
     * @param {string} filePath - full path with name
     * @param {string} [fileName] - if u want to override name in filePath
     * @param {FileFolder} [folder] - where to put the file
     * @public
     */
    upload = (filePath, fileName, folder) => {
        const keg = new File(User.current.kegDb, this);
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

                const disposer = when(() => keg.deleted, () => {
                    this.files.remove(keg);
                });
                when(() => keg.readyForDownload, () => {
                    disposer();
                });
                // move file into folder as soon as we have file id
                // it will either move it to local folder or volume
                if (folder) {
                    when(() => keg.fileId, () => folder.attach(keg));
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

    /**
     * Resume file store updates.
     */
    resume() {
        super.resume();
        setTimeout(() => {
            this.onFileDigestUpdate();
            this.updateDescriptors();
        });
    }
}

const ret = new FileStore();
setFileStore(ret);
module.exports = ret;
