const socket = require('../../network/socket');
const errors = require('../../errors');
const secret = require('../../crypto/secret');
const config = require('../../config');
const FileProcessor = require('./file-processor');

/**
 * Handles file upload process
 * @param {File} file
 * @param {FileStreamAbstract} stream
 * @param {FileNonceGenerator} nonceGenerator
 * @param {number} startFromChunk - in case of resume, start uploading from the chunk after this one
 * @extends {FileProcessor}
 */
class FileUploader extends FileProcessor {
    constructor(file, stream, nonceGenerator, startFromChunk) {
        super(file, stream, nonceGenerator, 'upload');
        // amount of bytes to read and to send
        this.file.progressMax = file.size;
        if (startFromChunk != null) {
            console.log(`Resuming upload. Starting with chunk ${startFromChunk}`);
            nonceGenerator.chunkId = startFromChunk;
            this.lastReadChunkId = startFromChunk - 1;
            this.file.progress = startFromChunk * file.chunkSize;
            console.log(`progress ${this.file.progress}`);
            stream.seek(startFromChunk * file.chunkSize);
            console.log(`Upload continues from ${stream.nextReadPos}`);
        }
        // socket.onDisconnect(this._error);
    }

    /**
     * read chunks go here
     * @member {Array<Uint8Array>}
     */
    encryptQueue = [];
    /**
     * encrypted chunks go here
     * @member {Array<Uint8Array>}
     */
    uploadQueue = [];
    /**
     * end of file reached while reading file
     * @member {boolean}
     */
    eofReached = false;
    /**
     * avoid parallel reads
     * @member {boolean}
     */
    readingChunk = false;
    /**
     * @member {number}
     */
    lastReadChunkId = -1;
    /**
     * amount of chunks that currently wait for response from server
     * @member {number}
     */
    chunksWaitingForResponse = 0;

    cleanup() {
        // socket.unsubscribe(socket.SOCKET_EVENTS.disconnect, this._error);
    }

    get _isEncryptQueueFull() {
        return (this.encryptQueue.length + 1) * this.file.chunkSize > config.upload.encryptBufferSize;
    }

    get _isUploadQueueFull() {
        // chunk overhead neglecting is ok, too small
        return (this.uploadQueue.length + 1) * this.file.chunkSize > config.upload.uploadBufferSize;
    }

    // reads chunk from fs and puts it in encryption queue
    _readChunk() {
        if (this.readingChunk || this.stopped || this.eofReached || this._isEncryptQueueFull) return;
        this.readingChunk = true;
        this.stream.read(this.file.chunkSize)
            .then(this._processReadChunk)
            .catch(this._error);
    }

    _processReadChunk = buffer => {
        this.readingChunk = false;
        if (this.stopped) return;
        // console.log(`read ${buffer.length} bytes`, `pos: ${this.stream.pos}`);
        if (buffer.length === 0) {
            this.eofReached = true;
        } else {
            this.encryptQueue.push({ id: ++this.lastReadChunkId, buffer });
        }
        this._tick();
    };

    _encryptChunk = () => {
        if (this.stopped || this._isUploadQueueFull || !this.encryptQueue.length) return;
        try {
            const chunk = this.encryptQueue.shift();
            const nonce = this.nonceGenerator.getNextNonce();
            chunk.buffer = secret.encrypt(chunk.buffer, this.fileKey, nonce, false, false);
            this.uploadQueue.push(chunk);
            this._tick();
        } catch (err) {
            this._error(err);
        }
    };

    _uploadChunk() {
        if (this.stopped || !this.uploadQueue.length
            || this.chunksWaitingForResponse >= config.upload.maxResponseQueue) return;

        const chunk = this.uploadQueue.shift();
        this.chunksWaitingForResponse++;
        // console.log(`sending chunk ${chunk.id}`);
        socket.send('/auth/file/chunk/upload', {
            fileId: this.file.fileId,
            chunkNum: chunk.id,
            chunk: chunk.buffer.buffer,
            last: !this.uploadQueue.length && this.nonceGenerator.eof
        }, true)
            .then(() => {
                this.chunksWaitingForResponse--;
                // console.log(`chunk ${chunk.id} sent`);
                if (this.stopped) return;
                this.file.progress += this.file.chunkSize;
                this._tick();
            })
            .catch(this._error);

        this._tick();
    }

    _checkIfFinished() {
        if (this.eofReached && !this.encryptQueue.length
            && !this.uploadQueue.length && !this.chunksWaitingForResponse) {
            this._finishProcess();
            return true;
        }
        return false;
    }

    // for logging and debugging
    toString() {
        return JSON.stringify({
            // fileId: this.file.fileId,
            encryptQueue: this.encryptQueue.length,
            uploadQueue: this.uploadQueue.length,
            stopped: this.stopped,
            eofReached: this.eofReached,
            finished: this.processFinished,
            lastReadChunkId: this.lastReadChunkId
        });
    }

    _tick = () => {
        if (this.processFinished || this._checkIfFinished()) return;
        setTimeout(() => {
            try {
                this._readChunk();
                setTimeout(this._encryptChunk);
                this._uploadChunk();
            } catch (err) {
                this._finishProcess(errors.normalize(err));
            }
        });
    }
}


module.exports = FileUploader;
