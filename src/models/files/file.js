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
/**
 * File keg and model.
 * @param {KegDb} db
 * @extends {Keg}
 * @public
 */
class File extends Keg {
    constructor(db, store) {
        super(null, 'file', db);
        this.store = store;
        this.format = 1;
        this.latestFormat = 1;
        this.descriptorFormat = 1;
    }

    @observable migrating = false;

    /**
     * System-wide unique client-generated id
     * @member {string} fileId
     * @memberof File
     * @instance
     * @public
     */
    @observable fileId = null;
    /**
     * Folder id
     * @member {string} folderId
     * @memberof File
     * @instance
     * @public
     */
    @observable folderId = null;
    /**
     * @member {string} name
     * @memberof File
     * @instance
     * @public
     */
    @observable name = '';
    /**
     * Bytes
     * @member {number} size
     * @memberof File
     * @instance
     * @public
     */
    @observable size = 0;
    /**
     * @member {number} uploadedAt
     * @memberof File
     * @instance
     * @public
     */
    @observable uploadedAt = null;

    /**
     * Username uploaded this file.
     * @member {string} fileOwner
     * @memberof File
     * @instance
     * @public
     */
    @observable fileOwner;

    /**
     * Indicates if last caching attempt failed
     * @memberof File
     */
    @observable cachingFailed = false;

    // -- View state data ----------------------------------------------------------------------------------------
    // Depends on server set property 'fileProcessingState'
    /**
     * When this is 'true' file is ready to be downloaded. Upload finishes before that,
     * then server needs some time to process file.
     * @member {boolean} readyForDownload
     * @memberof File
     * @instance
     * @public
     */
    @observable readyForDownload = false;
    /**
     * @member {boolean} uploading
     * @memberof File
     * @instance
     * @public
     */
    @observable uploading = false;
    /**
     * @member {boolean} downloading
     * @memberof File
     * @instance
     * @public
     */
    @observable downloading = false;
    /**
     * Upload or download progress value in bytes. Note that when uploading it doesn't count overhead.
     * @member {number} progress
     * @memberof File
     * @instance
     * @public
     */
    @observable progress = 0;
    /**
     * File size with overhead for downloads and without overhead for uploads.
     * @member {number} progressMax
     * @memberof File
     * @instance
     * @public
     */
    @observable progressMax = 0;

    /**
     * currently mobile only: flag means file was downloaded and is available locally
     * @member {boolean} cached
     * @memberof File
     * @instance
     * @public
     */
    @observable cached = false;

    /**
     * file was downloaded for inline image display
     * @member {boolean} tmpCached
     * @memberof File
     * @instance
     * @public
     */
    @observable tmpCached = false;

    /**
     * File was uploaded in this session from this device
     * and we saved it's original upload path. Useful for preview
     * launch
     * @member {String} originalUploadPath
     * @memberof File
     * @instance
     * @public
     */
    @observable originalUploadPath;

    /**
     * We have some type of path available for our file
     * It was cached for inline image view, uploaded during this session
     * or downloaded manually by user
     * TODO: REVIEW THIS AFTER NEWFS MERGE
     * @member {String} originalUploadPath
     * @memberof File
     * @instance
     * @public
     */
    get hasFileAvailableForPreview() {
        return this.originalUploadPath || this.cached || this.tmpCached;
    }

    /**
     * Is this file selected in file pickers for group operations.
     * It's a bit weird mix of UI state and logic, but it works fine at the moment,
     * we'll rethink it when we implement folders.
     * @member {boolean} selected
     * @memberof File
     * @instance
     * @public
     */
    @observable selected = false;
    /**
     * Is this file visible or filtered by search. Also weird, needs refactor.
     * @member {boolean} show
     * @memberof File
     * @instance
     * @public
     */
    @observable show = true;

    /**
     * Is this file currently shared with anyone.
     * @member {boolean} shared
     * @memberof File
     * @instance
     * @public
     */
    @observable shared = false;

    /**
     * Amount of visual components which display this file currently
     * @member {number} visibleCounter
     * @memberof File
     * @instance
     * @public
     */
    @observable visibleCounter = 0;

    // -- computed properties ------------------------------------------------------------------------------------
    /**
     * file extension
     * @member {string} ext
     * @memberof File
     * @instance
     * @public
     */
    @computed get ext() {
        return fileHelper.getFileExtension(this.name);
    }

    /**
     * file icon type
     * @member {string} ext
     * @memberof File
     * @instance
     * @public
     */
    @computed get iconType() {
        return fileHelper.getFileIconType(this.ext);
    }

    /**
     * which folder is this file located in
     * default: undefined (folders have not been loaded)
     * null: file is in the root folder
     * @member {FileFolder} folder
     * @memberof File
     * @instance
     * @public
     */
    @computed get folder() {
        const folder = this.store.folderStore.getById(this.folderId);
        return folder || this.store.folderStore.root;
    }

    @computed get isLegacy() {
        return !this.format;
    }


    descriptorVersion = 0;

    /**
     * @member {string} nameWithoutExt
     * @memberof File
     * @instance
     * @public
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
     * @member {string} cachePath
     * @memberof File
     * @instance
     * @public
     */
    @computed get cachePath() {
        if (!config.isMobile) return null;

        const name = `${this.name || this.fsSafeUid}.${this.ext}`;
        return config.FileStream.getFullPath(this.fsSafeUid, name);
    }
    /**
     * Human readable file size
     * @member {string} sizeFormatted
     * @memberof File
     * @instance
     * @public
     */
    @computed get sizeFormatted() {
        return util.formatBytes(this.size);
    }

    /**
     * @member {number} chunksCount
     * @memberof File
     * @instance
     * @public
     */
    @computed get chunksCount() {
        return Math.ceil(this.size / this.chunkSize);
    }

    /**
     * @member {boolean} canShare
     * @memberof File
     * @instance
     * @public
     */
    @computed get canShare() {
        return this.format === 1;
    }
    /**
     * Bytes
     * @member {number}
     * @public
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
        if (this.fileId && this.fileId !== d.fileId) throw new Error('Descriptor fileId mismatch');
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
     * @public
     */
    share(chat) {
        return this.copyTo(chat.db, getFileStore());
    }

    /**
     * Open file with system's default file type handler app.
     * @param {string} [path] - tries cachePath, tmpCachePath and originalUploadPath if path is not passed
     * @public
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
     * @public
     */
    deleteCache() {
        config.FileSystem.delete(this.cachePath);
        this.cached = false;
    }
    /**
     * Remove file from cloud and unshare with everyone.
     * @returns {Promise}
     * @public
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
     * @public
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
