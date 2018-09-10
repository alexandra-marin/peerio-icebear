import relativeTimestamp from '../../helpers/time-formatting';
import { serverErrorCodes } from '../../errors';
import Keg from './../kegs/keg';
import { observable, computed, action, IObservableArray } from 'mobx';
import * as cryptoUtil from '../../crypto/util';
import * as secret from '../../crypto/secret';
import * as sign from '../../crypto/sign';
import config from '../../config';
import socket from '../../network/socket';
import { getUser } from '../../helpers/di-current-user';
import { getFileStore } from '../../helpers/di-file-store';
import { retryUntilSuccess } from '../../helpers/retry';
import clientApp from '../client-app';
import { asPromise } from '../../helpers/prombservable';
import TaskQueue from '../../helpers/task-queue';
import FileStoreBase from './file-store-base';
import Chat from '../chats/chat';
import * as uploadModule from './file.upload';
import * as downloadModule from './file.download';
import FileData from './file-data';
import FileStreamBase from './file-stream-base';
import { FileStore } from './file-store';
import { IKegDb } from '../../defs/interfaces';
import FileDownloader from './file-downloader';
import FileUploader from './file-uploader';

const signDetached = sign.signDetached;

// TODO: deleted/unshared files will leak FileData object memory
// need ideas how to fix it without hooking into file stores
const fileDataMap = new Map<string, FileData>();

interface IFilePayload {}

interface IFileProps {}

export interface IFileDescriptor {}

/**
 * File keg and model.
 */
export default class File extends Keg<IFilePayload, IFileProps> {
    constructor(db: IKegDb, store: FileStoreBase) {
        super(null, 'file', db);
        this.store = store;
        this.format = 1;
        this.latestFormat = 1;
    }
    static copyQueue = new TaskQueue(1, 200);

    _getUlResumeParams?(path: string): Promise<any>;
    _saveUploadEndFact?(): void;
    _saveUploadStartFact?(path: string): void;
    cancelUpload?(): Promise<void>;
    upload?(filePath: string, fileName?: string, resume?: boolean): Promise<void>;

    _getDlResumeParams?(
        path: string
    ): Promise<
        | boolean
        | {
              wholeChunks: number;
              partialChunkSize: number;
          }
    >;
    _saveDownloadStartFact?(path: string): void;
    _saveDownloadEndFact?(): void;
    cancelDownload?(): void;
    download?(
        filePath: string,
        resume?: boolean,
        isTmpCacheDownload?: boolean,
        suppressSnackbar?: boolean
    ): Promise<void>;

    hidden: boolean;
    store: FileStoreBase;
    latestFormat: number;
    descriptorKey: string;
    unmigrated: boolean;

    downloader?: FileDownloader;
    uploader?: FileUploader;

    // files and folders get in mixed lists, so adding these properties helps for now
    isFolder = false;
    isShared = false; // TODO: rename this to 'isVolume'
    hasLegacyFiles = false;
    // ---

    // TODO: this is a pretty dirty hack to support UI, needs refactor
    uploadQueue?: IObservableArray<File>;

    get data() {
        if (!this.fileId) return null;
        let ret = fileDataMap.get(this.fileId);
        if (!ret) {
            ret = new FileData(this.fileId);
            fileDataMap.set(this.fileId, ret);
        }
        return ret;
    }

    @observable migrating = false;

    /**
     * System-wide unique client-generated id
     */
    @observable fileId: string;

    generateFileId() {
        if (this.fileId) return;
        this.fileId = cryptoUtil.getRandomUserSpecificIdB64(getUser().username);
    }
    /**
     * Folder id
     */
    @observable folderId: string = null;
    /**
     * Bytes
     */
    get size() {
        return this.data.size;
    }
    set size(val) {
        this.data.size = val;
    }
    /**
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
    @computed
    get uploadTimeFormatted() {
        return relativeTimestamp(this.uploadedAt.valueOf());
    }

    /**
     */
    get updatedAt() {
        return this.data.updatedAt;
    }
    set updatedAt(val) {
        this.data.updatedAt = val;
    }
    /**
     * Username uploaded this file.
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
     */
    get readyForDownload() {
        return this.data.readyForDownload;
    }

    set readyForDownload(val) {
        this.data.readyForDownload = val;
    }

    @observable uploading = false;
    uploaded: boolean;
    get downloading() {
        return this.data.downloading;
    }

    set downloading(val) {
        this.data.downloading = val;
    }
    /**
     * Upload or download progress value in bytes. Note that when uploading it doesn't count overhead.
     */
    get progress() {
        return this.data.progress;
    }

    set progress(val) {
        this.data.progress = val;
    }
    /**
     * File size with overhead for downloads and without overhead for uploads.
     */
    get progressMax() {
        return this.data.progressMax;
    }
    set progressMax(val) {
        this.data.progressMax = val;
    }

    /**
     * currently mobile only: flag means file was downloaded and is available locally
     */
    get cached() {
        return this.data.cached;
    }
    set cached(val) {
        this.data.cached = val;
    }

    /**
     * file was downloaded for inline image display
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
     */
    get hasFileAvailableForPreview() {
        return this.originalUploadPath || this.cached || this.tmpCached;
    }

    /**
     * Is this file selected in file pickers for group operations.
     * It's a bit weird mix of UI state and logic, but it works fine at the moment,
     * we'll rethink it when we implement folders.
     */
    @observable selected = false;

    /**
     * Is this file currently shared with anyone.
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
     */
    get name() {
        return this.data.name;
    }

    set name(name) {
        this.data.unsanitizedName = name;
    }

    get normalizedName() {
        return this.data.normalizedName;
    }

    /**
     * file extension
     */
    get ext() {
        return this.data.ext;
    }

    /**
     * file icon type
     */
    get iconType() {
        return this.data.iconType;
    }

    /**
     * which folder is this file located in
     * default: undefined (folders have not been loaded)
     * null: file is in the root folder
     */
    @computed
    get folder() {
        const folder = this.store.folderStore.getById(this.folderId);
        return folder || this.store.folderStore.root;
    }

    @computed
    get isLegacy() {
        return !this.format;
    }

    get descriptorVersion() {
        return this.data.descriptorVersion;
    }

    set descriptorVersion(val) {
        this.data.descriptorVersion = val;
    }

    get nameWithoutExtension() {
        return this.data.nameWithoutExtension;
    }

    get isImage() {
        return this.data.isImage;
    }

    get fsSafeUid() {
        return this.data.fsSafeUid;
    }

    get tmpCachePath() {
        return this.data.tmpCachePath;
    }

    /**
     * currently mobile only: Full path to locally stored file
     */
    get cachePath() {
        return this.data.cachePath;
    }
    /**
     * Human readable file size
     */
    get sizeFormatted() {
        return this.data.sizeFormatted;
    }

    get chunksCount() {
        return this.data.chunksCount;
    }

    @computed
    get canShare() {
        return this.format === 1;
    }
    /**
     * Bytes
     */
    get sizeWithOverhead() {
        return this.size + this.chunksCount * config.CHUNK_OVERHEAD;
    }

    get isOverInlineSizeLimit() {
        return this.data.isOverInlineSizeLimit;
    }

    get isOversizeCutoff() {
        return this.data.isOversizeCutoff;
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

    @action
    deserializeKegPayload(data) {
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

    @action
    deserializeProps(props) {
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
        const objPayload = {
            name: this.name,
            blobKey: this.blobKey,
            blobNonce: this.blobNonce
        };
        const stringPayload = JSON.stringify(objPayload);
        const payload = secret.encryptString(
            stringPayload,
            cryptoUtil.b64ToBytes(this.descriptorKey)
        );

        const binSignature = await signDetached(payload, getUser().signKeys.secretKey);
        const signature = cryptoUtil.bytesToB64(binSignature);

        const descriptor = {
            fileId: this.fileId,
            payload: payload.buffer,
            ext: this.ext,
            format: this.descriptorFormat,
            signature,
            signedBy: getUser().username,
            // to be filled by caller, server can accept or reject these props based on descriptor version
            size: undefined as number,
            chunkSize: undefined as number,
            version: undefined as number
        };
        return descriptor;
    }
    deserializeDescriptor(d) {
        if (!this.fileId) {
            this.fileId = d.fileId;
        }
        if (this.fileId !== d.fileId) throw new Error('Descriptor fileId mismatch');
        if (this.descriptorVersion >= d.version) return;
        if (!this.descriptorKey) {
            // this is a legacy file, owner migrated it and by default descriptorKey == blobKey during migration
            this.descriptorKey = this.blobKey;
        }
        this.uploadedAt = new Date(+d.createdAt);
        this.updatedAt = new Date(+d.updatedAt);
        this.readyForDownload = d.blobAvailable;
        this.fileOwner = d.owner;
        this.sharedBy = ''; // TODO: maybe
        this.chunkSize = +d.chunkSize;
        this.size = +d.size;
        this.descriptorFormat = d.format;
        this.shared = d.shared;
        this.role = d.effectiveRole;
        this.descriptorVersion = d.version;
        // TODO: it's pointless to verify signature currently
        // because replacing blobKey will not help attacker(server) to achieve anything except
        // preventing access to data, which is already possible by just removing keys
        // BUT once we have some feature that allows uploading new blob version with
        // existing blob key - we need to verify
        const binPayload = new Uint8Array(d.payload);
        const stringPayload = secret.decryptString(
            binPayload,
            cryptoUtil.b64ToBytes(this.descriptorKey)
        );
        const payload = JSON.parse(stringPayload);
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
        return socket.send('/auth/file/descriptor/update', descriptor, true).then(() => {
            // in case descriptor was updated while waiting for response
            if (this.descriptorVersion + 1 === version) {
                this.descriptorVersion = version;
            }
        });
    }

    /**
     * Shares file with a chat (creates a copy of the keg)
     * @param chat -  chat instance
     */
    share(chat: Chat) {
        return this.copyTo(chat.db, getFileStore());
    }

    /**
     * Open file with system's default file type handler app.
     * @param path - tries cachePath, tmpCachePath and originalUploadPath if path is not passed
     */
    launchViewer(path?: string) {
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
        config.FileStream.delete(this.cachePath);
        this.cached = false;
    }
    /**
     * Remove file from cloud and unshare with everyone.
     */
    remove() {
        this._resetUploadState();
        this._resetDownloadState();
        if (!this.id) return Promise.resolve();
        return retryUntilSuccess(
            () => super.remove(),
            `remove file ${this.id} from ${this.db.id}`,
            5
        ).then(() => {
            this.deleted = true;
        });
    }
    // TODO: better way to do this. Optional, so tsc won't complain, but it will always be defined.
    _resetDownloadState?(stream?: FileStreamBase): void;
    _resetUploadState?(stream?: FileStreamBase): void;

    /**
     * Safe to call any time after upload has been started (keg created).
     * Retries a few times in case of error.
     */
    rename(newName: string) {
        return retryUntilSuccess(
            () => {
                this.name = newName;
                return this.updateDescriptor().catch(err => {
                    if (err && err.code === serverErrorCodes.malformedRequest) {
                        return this.load(); // mitigating optimistic concurrency issues
                    }
                    return Promise.reject(err);
                });
            },
            undefined,
            5
        );
    }

    hide() {
        return retryUntilSuccess(
            () => {
                this.hidden = true;
                return this.saveToServer();
            },
            `hiding ${this.fileId} in ${this.db.id}`,
            5,
            () => this.load()
        );
    }
    unhide() {
        return retryUntilSuccess(
            () => {
                this.hidden = false;
                return this.saveToServer();
            },
            `unhiding ${this.fileId} in ${this.db.id}`,
            5,
            () => this.load()
        );
    }

    tryToCacheTemporarily(force = false) {
        if (
            this.tmpCached ||
            this.downloading ||
            (!force && !clientApp.uiUserPrefs.peerioContentEnabled) ||
            (!force && this.isOverInlineSizeLimit) ||
            this.isOversizeCutoff ||
            this.cachingFailed
        )
            return;

        this.downloadToTmpCache();
    }
    downloadToTmpCache(): any {
        throw new Error('Method not implemented.');
    }

    ensureLoaded() {
        return asPromise(this, 'loaded', true);
    }

    /**
     * Copies this file keg to another db
     * TODO: this is too dynamic type wise, probably better to refactor
     */
    copyTo(db: any, store: any, folderId?: string) {
        // TODO: ugly, refactor when chats get their own file stores
        const dstIsChat = db.id.startsWith('channel:') || db.id.startsWith('chat:');
        const dstIsSELF = db.id === 'SELF';
        const dstIsVolume = db.id.startsWith('volume:');
        if (dstIsChat) {
            const chatFile = (store as FileStore).getByIdInChat(db.id, this.fileId);
            if (chatFile && chatFile.loaded && !chatFile.deleted) return Promise.resolve();
        } else if (store.getById(this.fileId)) {
            return Promise.resolve();
        }
        return File.copyQueue.addTask(() =>
            retryUntilSuccess(
                async () => {
                    // to avoid creating empty keg
                    const resp = await socket.send(
                        '/auth/kegs/db/query',
                        {
                            kegDbId: db.id,
                            type: 'file',
                            filter: { fileId: this.fileId }
                        },
                        false
                    );
                    // file already exists in this db
                    if (resp.kegs.length) {
                        // we want to change folder and unhide file if needed
                        if (!folderId && !dstIsSELF) return null;
                        const existingKeg = new File(db, store);
                        await existingKeg.loadFromKeg(resp.kegs[0]);
                        existingKeg.folderId = folderId || existingKeg.folderId;
                        existingKeg.hidden = false;
                        return existingKeg.saveToServer();
                    }
                    const file = new File(db, store);
                    file.descriptorKey = this.descriptorKey;
                    file.fileId = this.fileId;
                    file.folderId = folderId;
                    try {
                        await file.saveToServer();
                        // a little hack adding the file object to store before it manages to update
                        // to reduce lag before file appears
                        if (!dstIsChat && !store.getById(this.fileId)) {
                            store.files.unshift(file);
                        }
                    } catch (err) {
                        if (err && err.code === serverErrorCodes.fileKegAlreadyExists) {
                            // need to delete empty keg
                            return file.remove();
                        }
                        throw err;
                    }
                    return null;
                },
                `copying ${this.fileId} to ${db.id}`,
                5
            ).then(() => {
                if (dstIsVolume && this.db.id === 'SELF') this.hide();
            })
        );
    }
}

Object.assign(File.prototype, uploadModule);
Object.assign(File.prototype, downloadModule);
