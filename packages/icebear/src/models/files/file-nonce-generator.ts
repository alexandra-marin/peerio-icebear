import * as util from '../../crypto/util';

/**
 * Helper class to generate sequential nonces for file chunks.
 * Creates new nonce, or reuses existing one. Chunk Id is zero-based.
 *
 * Nonce consists of 24 bytes
 * ```
 * 1    - last chunk flag. 0 - false, 1 - true
 * 2-5  - chunk counter
 * 6-24 - random
 * ```
 */
class FileNonceGenerator {
    /**
     * @param startChunkId - chunk id to start with (next nonce will use this id)
     * @param nonce - leave empty to generate random one
     */
    constructor(startChunkId: number, maxChunkId: number, nonce = util.getRandomNonce()) {
        this.nonce = nonce;
        this.chunkId = startChunkId;
        this.maxChunkId = maxChunkId;
        this._resetControlBytes();
        this.eof = false;
    }

    nonce: Uint8Array;
    chunkId: number;
    maxChunkId: number;
    eof: boolean;

    _resetControlBytes() {
        this.nonce.set([0, 0, 0, 0, 0]);
    }

    _writeChunkNum() {
        const bytes = util.numberToByteArray(this.chunkId);
        this.nonce.set(bytes, 1);
    }

    _writeLastChunkFlag() {
        this.nonce[0] = 1;
        this.eof = true;
    }

    /**
     * @returns nonce for the next chunk
     * @throws if called after nonce for maxChunkId was generated
     */
    getNextNonce(): Uint8Array | null {
        if (this.eof) throw new Error('Attempt to generate nonce past maxChunkId.');
        this._writeChunkNum();
        if (this.chunkId === this.maxChunkId) {
            this._writeLastChunkFlag();
        } else {
            this.chunkId++;
        }
        return this.nonce;
    }
}

export default FileNonceGenerator;
