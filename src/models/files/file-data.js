import { observable, computed } from 'mobx';
import * as fileHelper from '../../helpers/file';
import clientApp from '../client-app';
import * as cryptoUtil from '../../crypto/util';
import config from '../../config';
import * as util from '../../util';

// every unique file (fileId) has a set of properties we want to be shared between all the file kegs
// representing this file
export default class FileData {
    constructor(fileId) {
        this.fileId = fileId;
    }
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
    fileId = null;
    descriptorVersion = 0;
    descriptorFormat = 1;
    chunkSize = 0;
    blobKey = null;
    blobNonce = null;

    @computed
    get name() {
        return fileHelper.sanitizeBidirectionalFilename(this.unsanitizedName);
    }

    @computed
    get normalizedName() {
        return this.unsanitizedName ? this.unsanitizedName.toUpperCase() : '';
    }

    @computed
    get ext() {
        return fileHelper.getFileExtension(this.name);
    }

    @computed
    get iconType() {
        return fileHelper.getFileIconType(this.ext);
    }

    @computed
    get nameWithoutExtension() {
        return fileHelper.getFileNameWithoutExtension(this.name);
    }

    @computed
    get isImage() {
        return fileHelper.isImage(this.ext);
    }

    @computed
    get fsSafeUid() {
        return cryptoUtil.getHexHash(16, cryptoUtil.b64ToBytes(this.fileId));
    }

    @computed
    get tmpCachePath() {
        return config.FileStream.getTempCachePath(`${this.fsSafeUid}.${this.ext}`);
    }

    @computed
    get cachePath() {
        if (!config.isMobile) return null;

        const name = `${this.name || this.fsSafeUid}.${this.ext}`;
        return config.FileStream.getFullPath(this.fsSafeUid, name);
    }
    @computed
    get sizeFormatted() {
        return util.formatBytes(this.size);
    }

    @computed
    get chunksCount() {
        return Math.ceil(this.size / this.chunkSize);
    }

    @computed
    get isOverInlineSizeLimit() {
        return (
            clientApp.uiUserPrefs.limitInlineImageSize &&
            this.size > config.chat.inlineImageSizeLimit
        );
    }

    @computed
    get isOversizeCutoff() {
        return this.size > config.chat.inlineImageSizeLimitCutoff;
    }
}
