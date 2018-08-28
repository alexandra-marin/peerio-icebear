import errors from '../../errors';
import cryptoUtil from '../../crypto/util';
import FileStreamBase from '~/models/files/file-stream-base';
import FileNonceGenerator from '~/models/files/file-nonce-generator';

/**
 * Abstract parent class for FileDownloader and FileUploader
 */
class FileProcessor {
    constructor(
        file: File,
        stream: FileStreamBase,
        nonceGenerator: FileNonceGenerator,
        processType: 'upload' | 'download'
    ) {
        this.file = file;
        this.fileKey = cryptoUtil.b64ToBytes(file.blobKey);
        this.stream = stream;
        this.nonceGenerator = nonceGenerator;
        this.processType = processType;
    }

    /**
     * Next queue processing calls will stop if stopped == true
     */
    stopped = false;

    /**
     * process stopped and promise resolved/rejected
     */
    processFinished = false;

    /**
     * Starts the up/download process
     */
    start() {
        console.log(`starting ${this.processType} for file id: ${this.file.id}`);
        this._tick();
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    /**
     * Cancels process.
     */
    cancel() {
        this._finishProcess(new errors.UserCancelError(`${this.processType} cancelled`));
    }

    // stops process and resolves or rejects promise
    _finishProcess(err) {
        if (this.processFinished) return;
        this.processFinished = true;
        this.stopped = true; // bcs in case of error some calls might be scheduled
        this.stream
            .close()
            .then(() => {
                this.cleanup();
                if (err) {
                    console.log(`Failed to ${this.processType} file ${this.file.fileId}.`, err);
                    this.reject(errors.normalize(err));
                    return;
                }
                console.log(`${this.processType} success: ${this.file.fileId}`, this.toString());
                this.resolve();
            })
            .catch(closeErr => {
                this.cleanup();
                if (closeErr) {
                    // File may be not written completely.
                    console.log(`Failed to ${this.processType} file ${this.file.fileId}.`, err);
                    this.reject(errors.normalize(closeErr));
                }
            });
    }

    // shortcut to finish process with error
    _error = err => {
        this._finishProcess(err || new Error(`${this.processType} failed`));
    };

    /**
     * Override in child classes if cleanup is needed on finish.
     */
    cleanup() {}
}

export default FileProcessor;
