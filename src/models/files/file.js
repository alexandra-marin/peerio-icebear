const Keg = require('./../kegs/keg');
const { observable, computed, action } = require('mobx');
const { cryptoUtil, secret, sign: { signDetached } } = require('../../crypto');
const fileHelper = require('../../helpers/file');
const util = require('../../util');
const config = require('../../config');
const socket = require('../../network/socket');
const uploadModule = require('./file.upload');
const downloadModule = require('./file.download');
const { getUser } = require('../../helpers/di-current-user');
const { getFileStore } = require('../../helpers/di-file-store');
const { retryUntilSuccess } = require('../../helpers/retry');
const { ServerError } = require('../../errors');
const clientApp = require('../client-app');
const { asPromise } = require('../../helpers/prombservable');

// every unique file (fileId) has a set of properties we want to be shared between all the file kegs
// representing this file
class FileData {
    @observable size = 0;
    @observable uploadedAt = null;
    @observable updatedAt = null;
    @observable fileOwner;
    @observable unsanitizedName = '';
    @observable cachingFailed = false;
    @observable readyForDownload = false;
    // 'uploading' is not here because while uploading == true it's not possible to have 2+ kegs for the file
    @observable downloading = false;
    @observable progress = 0;
    @observable progressMax = 0;
    @observable cached = false;
    @observable tmpCached = false;
    @observable originalUploadPath;
    @observable shared = false;
    @observable sharedBy = '';
    @observable visibleCounter = 0;
    @observable role = '';
    descriptorVersion = 0;
    descriptorFormat = 1;
    chunkSize = 0;
    blobKey = null;
    blobNonce = null;
}

// TODO: deleted/unshared files will leak FileData object memory
// need ideas how to fix it without hooking into file stores
const fileDataMap = new Map();

/**
 * File keg and model.
 * @param {KegDb} db
 * @extends {Keg}
 */
class File extends Keg {
    constructor(db, store) {
        super(null, 'file', db);
        this.store = store;
        this.format = 1;
        this.latestFormat = 1;
    }

    get data() {
        if (!this.fileId) return null;
        let ret = fileDataMap.get(this.fileId);
        if (!ret) {
            ret = new FileData();
            fileDataMap.set(this.fileId, ret);
        }
        return ret;
    }

    @observable migrating = false;

    /**
     * System-wide unique client-generated id
     * @type {string}
     */
    @observable fileId = null;

    generateFileId() {
        if (this.fileId) return;
        this.fileId = cryptoUtil.getRandomUserSpecificIdB64(getUser().username);
    }
    /**
     * Folder id
     * @type {string}
     */
    @observable folderId = null;
    /**
     * Bytes
     * @type {number}
     */
    get size() {
        return this.data.size;
    }
    set size(val) {
        this.data.size = val;
    }
    /**
     * @type {number}
     */
    get uploadedAt() {
        return this.data.uploadedAt;
    }
    set uploadedAt(val) {
        this.data.uploadedAt = val;
    }
    /**
     * @type {number}
     */
    get updatedAt() {
        return this.data.updatedAt;
    }
    set updatedAt(val) {
        this.data.updatedAt = val;
    }
    /**
     * Username uploaded this file.
     * @type {string}
     */
    get fileOwner() {
        return this.data.fileOwner;
    }
    set fileOwner(val) {
        this.data.fileOwner = val;
    }

    /**
     * Indicates if last caching attempt failed
     */
    get cachingFailed() {
        return this.data.cachingFailed;
    }

    set cachingFailed(val) {
        this.data.cachingFailed = val;
    }

    /**
     * When this is 'true' file is ready to be downloaded. Upload finishes before that,
     * then server needs some time to process file.
     * @type {boolean}
     */
    get readyForDownload() {
        return this.data.readyForDownload;
    }

    set readyForDownload(val) {
        this.data.readyForDownload = val;
    }

    /**
     * @type {boolean}
     */
    @observable uploading = false;

    /**
     * @type {boolean}
     */
    get downloading() {
        return this.data.downloading;
    }

    set downloading(val) {
        this.data.downloading = val;
    }
    /**
     * Upload or download progress value in bytes. Note that when uploading it doesn't count overhead.
     * @type {number}
     */
    get progress() {
        return this.data.progress;
    }

    set progress(val) {
        this.data.progress = val;
    }
    /**
     * File size with overhead for downloads and without overhead for uploads.
     * @type {number}
     */
    get progressMax() {
        return this.data.progressMax;
    }
    set progressMax(val) {
        this.data.progressMax = val;
    }

    /**
     * currently mobile only: flag means file was downloaded and is available locally
     * @type {boolean}
     */
    get cached() {
        return this.data.cached;
    }
    set cached(val) {
        this.data.cached = val;
    }

    /**
     * file was downloaded for inline image display
     * @type {boolean}
     */
    get tmpCached() {
        return this.data.tmpCached;
    }
    set tmpCached(val) {
        this.data.tmpCached = val;
    }

    /**
     * File was uploaded in this session from this device
     * and we saved it's original upload path. Useful for preview
     * launch
     * @type {String}
     */
    get originalUploadPath() {
        return this.data.originalUploadPath;
    }
    set originalUploadPath(val) {
        this.data.originalUploadPath = val;
    }

    /**
     * We have some type of path available for our file
     * It was cached for inline image view, uploaded during this session
     * or downloaded manually by user
     * @type {bool}
     */
    get hasFileAvailableForPreview() {
        return this.originalUploadPath || this.cached || this.tmpCached;
    }

    /**
     * Is this file selected in file pickers for group operations.
     * It's a bit weird mix of UI state and logic, but it works fine at the moment,
     * we'll rethink it when we implement folders.
     * @type {boolean}
     */
    @observable selected = false;
    /**
     * Is this file visible or filtered by search. Also weird, needs refactor.
     * @type {boolean}
     */
    @observable show = true;

    /**
     * Is this file currently shared with anyone.
     * @type {boolean}
     */
    get shared() {
        return this.data.shared;
    }

    set shared(val) {
        this.data.shared = val;
    }

    get sharedBy() {
        return this.data.sharedBy;
    }

    set sharedBy(val) {
        this.data.sharedBy = val;
    }

    /**
     * Amount of visual components which display this file currently
     * @type {number}
     */
    get visibleCounter() {
        return this.data.visibleCounter;
    }

    set visibleCounter(val) {
        this.data.visibleCounter = val;
    }

    // -- computed properties ------------------------------------------------------------------------------------
    /**
     * file name
     * @member {string} name
     */
    @computed get name() {
        return fileHelper.sanitizeBidirectionalFilename(this.data.unsanitizedName);
    }

    set name(name) {
        this.data.unsanitizedName = name;
    }

    /**
     * file extension
     * @type {string}
     */
    @computed get ext() {
        return fileHelper.getFileExtension(this.name);
    }

    /**
     * file icon type
     * @type {string}
     */
    @computed get iconType() {
        return fileHelper.getFileIconType(this.ext);
    }

    /**
     * which folder is this file located in
     * default: undefined (folders have not been loaded)
     * null: file is in the root folder
     * @type {FileFolder}
     */
    @computed get folder() {
        const folder = this.store.folderStore.getById(this.folderId);
        return folder || this.store.folderStore.root;
    }

    @computed get isLegacy() {
        return !this.format;
    }


    get descriptorVersion() {
        return this.data.descriptorVersion;
    }

    set descriptorVersion(val) {
        this.data.descriptorVersion = val;
    }

    /**
     * @type {string}
     */
    @computed get nameWithoutExtension() {
        return fileHelper.getFileNameWithoutExtension(this.name);
    }

    @computed get isImage() {
        return fileHelper.isImage(this.ext);
    }

    @computed get fsSafeUid() {
        return cryptoUtil.getHexHash(16, cryptoUtil.b64ToBytes(this.fileId));
    }
    @computed get tmpCachePath() {
        return config.FileStream.getTempCachePath(`${this.fsSafeUid}.${this.ext}`);
    }
    /**
     * currently mobile only: Full path to locally stored file
     * @type {string}
     */
    @computed get cachePath() {
        if (!config.isMobile) return null;

        const name = `${this.name || this.fsSafeUid}.${this.ext}`;
        return config.FileStream.getFullPath(this.fsSafeUid, name);
    }
    /**
     * Human readable file size
     * @type {string}
     */
    @computed get sizeFormatted() {
        return util.formatBytes(this.size);
    }

    /**
     * @type {number}
     */
    @computed get chunksCount() {
        return Math.ceil(this.size / this.chunkSize);
    }

    /**
     * @type {boolean}
     */
    @computed get canShare() {
        return this.format === 1;
    }
    /**
     * Bytes
     * @type {number}
     */
    get sizeWithOverhead() {
        return this.size + this.chunksCount * config.CHUNK_OVERHEAD;
    }

    @computed get isOverInlineSizeLimit() {
        return clientApp.uiUserPrefs.limitInlineImageSize && this.size > config.chat.inlineImageSizeLimit;
    }

    @computed get isOversizeCutoff() {
        return this.size > config.chat.inlineImageSizeLimitCutoff;
    }

    get chunkSize() {
        return this.data.chunkSize;
    }
    set chunkSize(val) {
        this.data.chunkSize = val;
    }

    get role() {
        return this.data.role;
    }

    set role(val) {
        this.data.role = val;
    }

    get descriptorFormat() {
        return this.data.descriptorFormat;
    }

    set descriptorFormat(val) {
        this.data.descriptorFormat = val;
    }

    get blobKey() {
        return this.data.blobKey;
    }

    set blobKey(val) {
        this.data.blobKey = val;
    }
    get blobNonce() {
        return this.data.blobNonce;
    }

    set blobNonce(val) {
        this.data.blobNonce = val;
    }


    serializeKegPayload() {
        if (!this.format) {
            return {
                name: this.name,
                key: this.blobKey,
                nonce: this.blobNonce
            };
        }
        return {
            descriptorKey: this.descriptorKey
        };
    }

    @action deserializeKegPayload(data) {
        if (!this.format) {
            this.name = data.name;
            this.blobKey = data.key;
            this.blobNonce = data.nonce;
        } else {
            this.descriptorKey = data.descriptorKey;
        }
    }

    serializeProps() {
        return {
            fileId: this.fileId,
            folderId: this.folderId
        };
    }

    @action deserializeProps(props) {
        this.fileId = props.fileId;
        if (!this.fileId) return; // happens with keg version==1
        this.folderId = props.folderId;
        if (!this.format) {
            this.readyForDownload = true;
            this.size = +props.size;
            this.uploadedAt = new Date(+props.uploadedAt);
            this.fileOwner = props.owner || this.owner;
            this.sharedBy = props.sharedBy;
            this.chunkSize = +props.chunkSize;
            this.shared = props.shared;
        }
    }

    async serializeDescriptor() {
        let payload = {
            name: this.name,
            blobKey: this.blobKey,
            blobNonce: this.blobNonce
        };
        payload = JSON.stringify(payload);
        payload = secret.encryptString(payload, cryptoUtil.b64ToBytes(this.descriptorKey));

        let signature = await signDetached(payload, getUser().signKeys.secretKey);
        signature = cryptoUtil.bytesToB64(signature);

        const descriptor = {
            fileId: this.fileId,
            payload: payload.buffer,
            ext: this.ext,
            format: this.descriptorFormat,
            signature,
            signedBy: getUser().username
        };
        return descriptor;
    }
    deserializeDescriptor(d) {
        if (!this.fileId) {
            this.fileId = d.fileId;
        }
        if (this.fileId !== d.fileId) throw new Error('Descriptor fileId mismatch');
        if (this.descriptorVersion > d.version) return;
        if (!this.descriptorKey) {
            // this is a legacy file, owner migrated it and by default descriptorKey == blobKey during migration
            this.descriptorKey = this.blobKey;
        }
        this.uploadedAt = new Date(+d.createdAt);
        this.updatedAt = new Date(+d.updatedAt);
        this.readyForDownload = d.blobAvailable;
        this.fileOwner = d.owner;
        this.sharedBy = '';// TODO: maybe
        this.chunkSize = +d.chunkSize;
        this.size = +d.size;
        this.descriptorFormat = d.format;
        this.shared = d.shared;
        this.role = d.effectiveRole;
        this.descriptorVersion = d.version;
        let payload = new Uint8Array(d.payload);
        payload = secret.decryptString(payload, cryptoUtil.b64ToBytes(this.descriptorKey));
        payload = JSON.parse(payload);
        this.name = payload.name;
        this.blobKey = payload.blobKey;
        this.blobNonce = payload.blobNonce;
    }

    async createDescriptor() {
        const descriptor = await this.serializeDescriptor();
        descriptor.size = this.size;
        descriptor.chunkSize = this.chunkSize;
        return socket.send('/auth/file/descriptor/create', descriptor, true);
    }

    async updateDescriptor() {
        const descriptor = await this.serializeDescriptor();
        const version = this.descriptorVersion + 1;
        descriptor.version = version;
        return socket.send('/auth/file/descriptor/update', descriptor, true)
            .then(() => {
                // in case descriptor was updated while waiting for response
                if (this.descriptorVersion + 1 === version) {
                    this.descriptorVersion = version;
                }
            });
    }

    /**
     * Shares file with a chat (creates a copy of the keg)
     * @param {Chat} any chat instance
     * @returns {Promise}
     */
    share(chat) {
        return this.copyTo(chat.db, getFileStore());
    }

    /**
     * Open file with system's default file type handler app.
     * @param {string} [path] - tries cachePath, tmpCachePath and originalUploadPath if path is not passed
     */
    launchViewer(path) {
        let filePath = null;
        // if inline image was saved for preview
        if (this.tmpCached) filePath = this.tmpCachePath;
        // if file was downloaded manually by user
        if (this.cached) filePath = this.cachePath;
        // if we uploaded file in this session
        if (this.originalUploadPath) filePath = this.originalUploadPath;
        return config.FileStream.launchViewer(path || filePath);
    }

    /**
     * Remove locally stored file copy. Currently only mobile uses this.
     */
    deleteCache() {
        config.FileSystem.delete(this.cachePath);
        this.cached = false;
    }
    /**
     * Remove file from cloud and unshare with everyone.
     * @returns {Promise}
     */
    remove() {
        this._resetUploadState();
        this._resetDownloadState();
        if (!this.id) return Promise.resolve();
        return retryUntilSuccess(
            () => super.remove(),
            `remove file ${this.id} from ${this.db.id}`,
            5)
            .then(() => { this.deleted = true; });
    }

    /**
     * Safe to call any time after upload has been started (keg created).
     * Retries a few times in case of error.
     * @param {string} newName
     * @returns {Promise}
     */
    rename(newName) {
        return retryUntilSuccess(() => {
            this.name = newName;
            return this.updateDescriptor()
                .catch(err => {
                    if (err && err.code === ServerError.codes.malformedRequest) {
                        return this.load(); // mitigating optimistic concurrency issues
                    }
                    return Promise.reject(err);
                });
        }, undefined, 5);
    }

    tryToCacheTemporarily(force) {
        if (this.tmpCached
            || this.downloading
            || (!force && !clientApp.uiUserPrefs.peerioContentEnabled)
            || (!force && this.isOverInlineSizeLimit)
            || this.isOversizeCutoff
            || this.cachingFailed) return;

        this.downloadToTmpCache();
    }

    ensureLoaded() {
        return asPromise(this, 'loaded', true);
    }

    /**
     * Copies this file keg to another db
     * @param {KegDb} db
     */
    copyTo(db, store, folderId) {
        return retryUntilSuccess(() => {
            // to avoid creating empty keg
            return socket.send('/auth/kegs/db/query', {
                kegDbId: db.id,
                type: 'file',
                filter: { fileId: this.fileId }
            }, false)
                .then(resp => {
                    // file already exists in this db
                    if (resp.kegs.length) {
                        if (!folderId) return Promise.resolve;
                        const existingKeg = new File(db, store);
                        existingKeg.loadFromKeg(resp.kegs[0]);
                        existingKeg.folderId = folderId;
                        return existingKeg.saveToServer();
                    }
                    const file = new File(db, store);
                    file.descriptorKey = this.descriptorKey;
                    file.fileId = this.fileId;
                    file.folderId = folderId;
                    return file.saveToServer()
                        .then(() => {
                            // a little hack adding the file object to store before it manages to update
                            // to reduce lag before file appears
                            if (!store.getById(this.fileId)) {
                                store.files.unshift(file);
                            }
                        })
                        .catch(err => {
                            if (err && err.code === ServerError.codes.fileKegAlreadyExists) {
                                // need to delete empty keg
                                return file.remove();
                            }
                            return Promise.reject(err);
                        });
                });
        }, `copying ${this.fileId} to ${db.id}`, 10);
    }
}

uploadModule(File);
downloadModule(File);

module.exports = File;
