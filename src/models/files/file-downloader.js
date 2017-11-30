const socket = require('../../network/socket');
const secret = require('../../crypto/secret');
const config = require('../../config');
const FileProcessor = require('./file-processor');
const { DisconnectedError } = require('../../errors');

const { CHUNK_OVERHEAD } = config;

/**
 * Manages file download process.
 * @param {File} file
 * @param {FileStreamAbstract} stream
 * @param {FileNonceGenerator} nonceGenerator
 * @param {{partialChunkSize:number, wholeChunks:number}} resumeParams
 * @extends {FileProcessor}
 * @protected
 */
class FileDownloader extends FileProcessor {
    constructor(file, stream, nonceGenerator, resumeParams) {
        super(file, stream, nonceGenerator, 'download');
        // total amount to download and save to disk
        this.file.progressMax = file.sizeWithOverhead;
        this.getUrlParams = { fileId: file.fileId };
        this.chunkSizeWithOverhead = file.chunkSize + CHUNK_OVERHEAD;
        this.downloadChunkSize = Math.floor(config.download.maxDownloadChunkSize / this.chunkSizeWithOverhead)
            * this.chunkSizeWithOverhead;
        if (resumeParams) {
            this.partialChunkSize = resumeParams.partialChunkSize;
            nonceGenerator.chunkId = resumeParams.wholeChunks;
            this.file.progress = this.chunkSizeWithOverhead * resumeParams.wholeChunks;
            this.downloadPos = this.chunkSizeWithOverhead * resumeParams.wholeChunks;
        }
        // socket.onDisconnect(this._abortXhr);
    }

    /**
     * Chunks as they were uploaded
     * @member {Array<Uint8Array>}
     * @protected
     */
    decryptQueue = [];
    /**
     * Flag to indicate that chunk is currently waiting for write promise resolve to avoid parallel writes.
     * @member {boolean}
     * @protected
     */
    writing = false;
    /**
     * Avoid parallel downloads
     * @member {boolean}
     * @protected
     */
    downloading = false;
    /**
     *  position of the blob as it is stored in the cloud
     * @member {number}
     * @protected
     */
    downloadPos = 0;
    /**
     * blob was fully read
     * @member {boolean}
     * @protected
     */
    downloadEof = false;


    get _isDecryptQueueFull() {
        return (this.decryptQueue.length * (this.chunkSizeWithOverhead + 1))
            > config.download.maxDecryptBufferSize;
    }

    _abortXhr = () => {
        if (this.currentXhr) this.currentXhr.abort();
    };

    cleanup() {
        this._abortXhr();
        // socket.unsubscribe(socket.SOCKET_EVENTS.disconnect, this._abortXhr);
    }

    // downloads config.download.chunkSize size chunk and stores it in parseQueue
    _downloadChunk() {
        if (this.stopped || this.downloading || this.downloadEof || this._isDecryptQueueFull) return;

        this.downloading = true;
        this._getChunkUrl(this.downloadPos, this.downloadPos + this.downloadChunkSize - 1)
            .then(this._download)
            .then(dlChunk => {
                if (dlChunk.byteLength === 0) {
                    this.downloadEof = true;
                    this.downloading = false;
                    this._tick();
                    return;
                }
                this.downloadPos += dlChunk.byteLength;
                for (let i = 0; i < dlChunk.byteLength; i += this.chunkSizeWithOverhead) {
                    const chunk = new Uint8Array(
                        dlChunk, i,
                        Math.min(this.chunkSizeWithOverhead, dlChunk.byteLength - i)
                    );
                    this.decryptQueue.push(chunk);
                }
                if (this.downloadPos >= this.file.sizeWithOverhead) {
                    this.downloadEof = true;
                }
                this.downloading = false;
                this._tick();
            })
            .catch(this._error);
    }

    _decryptChunk() {
        if (this.stopped || this.writing || !this.decryptQueue.length) return;
        let chunk = this.decryptQueue.shift();
        const nonce = this.nonceGenerator.getNextNonce();
        chunk = secret.decrypt(chunk, this.fileKey, nonce, false);
        this.writing = true;
        if (this.partialChunkSize) {
            chunk = new Uint8Array(chunk, this.partialChunkSize, chunk.length - this.partialChunkSize);
            this.partialChunkSize = 0;
        }
        this.stream.write(chunk).then(this._onWriteEnd).catch(this._error);
    }

    _onWriteEnd = () => {
        this.writing = false;
        this._tick();
    };

    _checkIfFinished() {
        if (this.downloadEof && !this.decryptQueue.length && !this.writing) {
            this._finishProcess();
            return true;
        }
        return false;
    }
    _tick = () => {
        if (this.processFinished || this._checkIfFinished()) return;
        setTimeout(() => {
            try {
                this._downloadChunk();
                this._decryptChunk();
            } catch (err) {
                this._error(err);
            }
        });
    };

    _getChunkUrl(from, to) {
        return socket.send('/auth/file/url', this.getUrlParams)
            .then(f => `${f.url}?rangeStart=${from}&rangeEnd=${to}`);
    }

    // if enabling support for parallel XHR requests - convert this to array
    currentXhr = null;

    _download = (url) => {
        const self = this;
        let lastLoaded = 0;
        let totalLoaded = 0;
        let retryCount = 0;
        // For refactoring lovers: (yes, @anri, you)
        // - don't convert event handlers to arrow functions
        const p = new Promise((resolve, reject) => {
            const xhr = this.currentXhr = new XMLHttpRequest();

            const trySend = () => {
                self.file.progress -= totalLoaded;
                // had to do this bcs uploaded blob takes some time to propagate through cloud
                if (retryCount++ >= 5) return false;
                if (retryCount > 0) {
                    console.log('Blob download retry attempt: ', retryCount, url);
                }
                setTimeout(() => {
                    xhr.open('GET', url);
                    xhr.responseType = 'arraybuffer';
                    xhr.send();
                }, 3000);
                return true;
            };

            xhr.onreadystatechange = function() {
                if (this.readyState !== 4) return;
                if (this.status === 200 || this.status === 206) {
                    resolve(this.response);
                    return;
                }
                console.error('Download blob error: ', this.status);
                if (!p.isRejected()) {
                    if (!trySend()) reject(socket.authenticated ? undefined : new DisconnectedError());
                }
            };

            xhr.onprogress = function(event) {
                if (p.isRejected()) return;
                self.file.progress += event.loaded - lastLoaded;
                lastLoaded = event.loaded;
                totalLoaded += lastLoaded;
            };

            xhr.ontimeout = xhr.onabort = xhr.onerror = function() {
                if (!p.isRejected() && !trySend()) reject();
            };

            trySend();
        }).finally(() => { this.currentXhr = null; });

        return p;
    };
}

module.exports = FileDownloader;
