const Keg = require('./../kegs/keg');
const { observable, computed, action, isObservableArray } = require('mobx');
const { cryptoUtil, secret } = require('../../crypto');
const fileHelper = require('../../helpers/file');
const util = require('../../util');
const config = require('../../config');
const socket = require('../../network/socket');
const uploadModule = require('./file.upload');
const downloadModule = require('./file.download');
const { getUser } = require('../../helpers/di-current-user');
const { retryUntilSuccess } = require('../../helpers/retry');
const { ServerError } = require('../../errors');
const clientApp = require('../client-app');

/**
 * File keg and model.
 * @param {KegDb} db
 * @extends {Keg}
 * @public
 */
class File extends Keg {
    constructor(db) {
        super(null, 'file', db);
    }

    /**
     * Blob key
     * @member {Uint8Array}
     * @public
     */
    key;
    /**
     * Blob nonce. It's separate because this is a base nonce, every chunk adds its number to it to decrypt.
     * @member {Uint8Array}
     * @public
     */
    nonce;
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

    @observable tmpCached = false;

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
    @observable folder;

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
        return true; // getUser().username === this.fileOwner;
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
        return {
            name: this.name,
            key: this.key,
            nonce: this.nonce
        };
    }

    @action deserializeKegPayload(data) {
        this.name = data.name;
        this.key = data.key;
        this.nonce = data.nonce;
    }

    serializeProps() {
        return {
            fileId: this.fileId,
            folderId: this.folderId,
            size: this.size,
            ext: this.ext, // don't really need to store, since it's computed, but we want to search by extension
            uploadedAt: this.uploadedAt.valueOf(),
            chunkSize: this.chunkSize
        };
    }

    @action deserializeProps(props) {
        this.fileId = props.fileId;
        this.folderId = props.folderId;
        this.readyForDownload = props.fileProcessingState === 'ready' || !!props.sharedBy;
        this.size = +props.size;
        this.uploadedAt = new Date(+props.uploadedAt);
        this.fileOwner = props.owner || this.owner;
        this.sharedBy = props.sharedBy;
        this.chunkSize = +props.chunkSize;
        this.shared = props.shared;
    }

    /**
     * Share file with contacts
     * @param {Contact|Array<Contact>|ObservableArray<Contact>} contactOrContacts
     * @returns {Promise}
     * @public
     */
    share(contactOrContacts) {
        const contacts =
            (Array.isArray(contactOrContacts) || isObservableArray(contactOrContacts))
                ? contactOrContacts
                : [contactOrContacts];

        // Generate a new random payload key.
        const payloadKey = cryptoUtil.getRandomBytes(32);

        // Serialize payload.
        const payload = JSON.stringify(this.serializeKegPayload());

        // Encrypt payload with the payload key.
        const encryptedPayload = secret.encryptString(payload, payloadKey);

        // Encrypt message key for each recipient's public key.
        //
        // {
        //   "user1": { "publicKey": ..., "encryptedKey": ... },
        //   "user2": { "publicKey": ..., "encryptedKey": ... }
        //   ...
        //  }
        //
        const recipients = {};
        contacts.forEach(contact => {
            recipients[contact.username] = {
                publicKey: cryptoUtil.bytesToB64(contact.encryptionPublicKey),
                encryptedPayloadKey: cryptoUtil.bytesToB64(
                    secret.encrypt(payloadKey, getUser().getSharedKey(contact.encryptionPublicKey))
                )
            };
        });

        const data = {
            recipients,
            originalKegId: this.id,
            keg: {
                type: this.type,
                payload: encryptedPayload.buffer,
                // todo: this is questionable, could we leak properties we don't want to this way?
                // todo: on the other hand we can forget to add properties that we do want to share
                props: this.serializeProps()
            }
        };

        // when we implement key change history, this will help to figure out which key to use
        // this properties should not be blindly trusted, recipient verifies them
        data.keg.props.sharedKegSenderPK = cryptoUtil.bytesToB64(getUser().encryptionKeys.publicKey);

        return retryUntilSuccess(() => socket.send('/auth/kegs/share', data));
    }

    /**
     * Open file with system's default file type handler app.
     * @param {string} [path] - tries this.cachePath if path is not passed
     * @public
     */
    launchViewer(path) {
        return config.FileStream.launchViewer(path || this.cachePath);
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
        return retryUntilSuccess(() => super.remove(), `remove file ${this.id}`, 3)
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
            return this.saveToServer()
                .catch(err => {
                    if (err instanceof ServerError && err.code === ServerError.codes.malformedRequest) {
                        return this.load();
                    }
                    return Promise.reject(err);
                });
        }, 5);
    }

    tryToCacheTemporarily(force) {
        if (this.tmpCached
            || this.downloading
            || !clientApp.uiUserPrefs.peerioContentEnabled
            || (!force && this.isOverInlineSizeLimit)
            || this.isOversizeCutoff
            || this.cachingFailed) return;

        this.downloadToTmpCache();
    }
}

uploadModule(File);
downloadModule(File);

module.exports = File;
