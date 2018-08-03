const { AbstractCallError } = require('../../errors');

/**
 * Abstract File Stream class. Icebear wants to read/write files,
 * but doesn't know how exactly that would work on your platform.
 *
 * 1. create you own class and inherit from FileStreamAbstract.
 * 2. override required functions.
 * 3. set config.FileStream = YourFileStreamImplementation.
 */
export default abstract class FileStreamAbstract {
    readonly filePath: string;
    readonly mode: string;

    pos: number;

    /**
     * @param filePath - will be used by 'open' function
     * @param mode - 'read' or 'write' or 'append'
     */
    constructor(filePath: string, mode: string) {
        this.filePath = filePath;
        if (mode !== 'read' && mode !== 'write' && mode !== 'append') {
            throw new Error('Invalid stream mode.');
        }
        this.mode = mode;
        this.pos = 0;
    }

    /**
     * Reads a chunk of data from file stream.
     * @param size amount of bytes to read (if possible)
     * @return resolves with a number of bytes written to buffer
     */
    read = (size: number): Promise<Uint8Array> => {
        if (this.mode !== 'read') {
            return Promise.reject(
                new Error('Attempt to read from write stream.')
            );
        }
        return this.readInternal(size).then(this._increasePosition);
    };

    _increasePosition = buf => {
        this.pos += buf.length;
        return buf;
    };

    /**
     * @param size The size in bytes.
     */
    abstract readInternal(size: number): Promise<Uint8Array>;

    /**
     * Writes a chunk of data to file stream
     * @returns Promise that resolves when chunk is written out
     */
    write = (buffer: Uint8Array): Promise<void> => {
        if (this.mode !== 'write' && this.mode !== 'append') {
            return Promise.reject(
                new Error(
                    `file-stream.js: Attempt to write to read stream. ${
                        this.mode
                    }`
                )
            );
        }
        this._increasePosition(buffer);
        if (!buffer || !buffer.length) return Promise.resolve();
        return this.writeInternal(buffer).then(this._increasePosition);
    };

    /**
     * Override this in your implementation.
     * @returns Promise that resolves to the same buffer as was passed
     */
    abstract writeInternal(buffer: Uint8Array): Promise<Uint8Array>;

    /**
     * Move file position pointer.
     */
    seek = (pos: number): number => {
        if (this.mode !== 'read') throw new Error('Seek only on read streams');
        return this.seekInternal(pos);
    };

    /**
     * Override this in your implementation. Move file position pointer.
     * @returns new position
     */
    abstract seekInternal(pos: number): number;

    /**
     * Override. This function has to set 'size' property.
     * @returns Promise that resolves to this stream
     */
    abstract open(): Promise<FileStreamAbstract>;

    /**
     * Override. Called when done working with file, should flush all buffers and dispose resources.
     * @abstract
     */
    close() {
        throw new AbstractCallError();
    }

    /**
     * Override. Returns full path for file when there's a default cache path implemented in the app.
     * Currently only mobile.
     * @param {string} uid - unique identifier
     * @param {string} name - human-readable file name
     * @returns {string} - actual device path for file
     * @abstract
     */
    static getFullPath(uid: string, name: string): string {
        throw new AbstractCallError();
    }

    /**
     * Override.
     * @param {string} path
     * @returns {Promise<boolean>} - true if path exists on device
     * @abstract
     */
    static exists(path: string): Promise<boolean> {
        throw new AbstractCallError();
    }

    /**
     * Override. Launch external viewer.
     * @param {string} path - file path to open in a viewer.
     * @abstract
     */
    static launchViewer(path: string) {
        throw new AbstractCallError();
    }

    /**
     * Override. Get file stat object.
     * @param {string} path
     * @returns {{size:number}}
     * @abstract
     */
    static getStat(path: string): { size: number } {
        throw new AbstractCallError();
    }

    /**
     * Override. Currently mobile only.
     * @returns Promise<string[]> - array of absolute paths to cached items.
     * @abstract
     */
    static getCacheList() {
        throw new AbstractCallError();
    }

    /**
     * Override. Removes file by path.
     * @param {string} path
     * @returns {Promise}
     * @abstract
     */
    static delete(path: string): Promise<any> {
        throw new AbstractCallError();
    }

    /**
     * Override. Renames old path to new path.
     * @param {string} oldPath
     * @param {string} newPath
     * @returns {Promise}
     * @abstract
     */
    static rename(oldPath: string, newPath: string): Promise<any> {
        throw new AbstractCallError();
    }

    /**
     * Override. Returns a path for storing temporarily downloaded(cached) files.
     */
    static getTempCachePath(name) {
        throw new AbstractCallError();
    }

    /**
     * Override. Creates a directory at "path".
     */
    static createDir(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Empties and them removes a directory at "path".
     */
    static removeDir(path) {
        throw new AbstractCallError();
    }
}
