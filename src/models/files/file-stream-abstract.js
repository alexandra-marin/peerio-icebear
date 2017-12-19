/* eslint-disable no-unused-vars */
const { AbstractCallError } = require('../../errors');

/**
 * Abstract File Stream class. Icebear wants to read/write files,
 * but doesn't know how exactly that would work on your platform.
 *
 * 1. create you own class and inherit from FileStreamAbstract.
 * 2. override required functions.
 * 3. set config.FileStream = YourFileStreamImplementation.
 * @param {string} filePath - will be used by 'open' function
 * @param {string} mode - 'read' or 'write' or 'append'
 * @public
 */
class FileStreamAbstract {
    /**
     * @member {string}
     * @public
     */
    filePath;
    /**
     * @member {string}
     * @public
     */
    mode;
    /**
     * File stream pointer
     * @member {number}
     * @public
     */
    pos;

    constructor(filePath, mode) {
        this.filePath = filePath;
        if (mode !== 'read' && mode !== 'write' && mode !== 'append') {
            throw new Error('Invalid stream mode.');
        }
        this.mode = mode;
        this.pos = 0;
    }

    /**
     * Reads a chunk of data from file stream.
     * @function read
     * @param {number} size - amount of bytes to read (if possible)
     * @return {Promise<Uint8Array>} - resolves with a number of bytes written to buffer
     * @public
     */
    read = (size) => {
        if (this.mode !== 'read') {
            return Promise.reject(new Error('Attempt to read from write stream.'));
        }
        return this.readInternal(size).then(this._increasePosition);
    };

    _increasePosition = (buf) => {
        this.pos += buf.length;
        return buf;
    };

    /**
     * Override this in your implementation.
     * @param {number} size - bytes
     * @returns {Promise<Uint8Array>}
     * @abstract
     * @protected
     */
    readInternal(size) {
        throw new AbstractCallError();
    }

    /**
     * Writes a chunk of data to file stream
     * @function write
     * @param {Uint8Array} buffer
     * @returns {Promise} - resolves when chunk is written out
     * @public
     */
    write = (buffer) => {
        if (this.mode !== 'write' && this.mode !== 'append') {
            return Promise.reject(new Error(`file-stream.js: Attempt to write to read stream. ${this.mode}`));
        }
        this._increasePosition(buffer);
        if (!buffer || !buffer.length) return Promise.resolve();
        return this.writeInternal(buffer).then(this._increasePosition);
    };

    /**
     * Override this in your implementation.
     * @param {Uint8Array} buffer
     * @returns {Promise<Uint8Array>} buffer, same one as was passed
     * @abstract
     * @protected
     */
    writeInternal(buffer) {
        throw new AbstractCallError();
    }

    /**
     * Move file position pointer.
     * @function seek
     * @param {number} pos
     * @returns {number} new position
     * @public
     */
    seek = (pos) => {
        if (this.mode !== 'read') throw new Error('Seek only on read streams');
        return this.seekInternal(pos);
    };

    /**
     * Override this in your implementation. Move file position pointer.
     * @param {number} pos
     * @returns {number} new position
     * @protected
     */
    seekInternal(pos) {
        throw new AbstractCallError();
    }


    /**
     * Override. This function has to set 'size' property.
     * @returns {Promise<FileStreamAbstract>} - this
     * @abstract
     * @public
     */
    open() {
        throw new AbstractCallError();
    }

    /**
     * Override. Called when done working with file, should flush all buffers and dispose resources.
     * @abstract
     * @public
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
     * @public
     */
    static getFullPath(uid, name) {
        throw new AbstractCallError();
    }

    /**
     * Override.
     * @param {string} path
     * @returns {Promise<boolean>} - true if path exists on device
     * @abstract
     * @public
     */
    static exists(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Launch external viewer.
     * @param {string} path - file path to open in a viewer.
     * @abstract
     * @public
     */
    static launchViewer(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Get file stat object.
     * @static
     * @param {string} path
     * @returns {{size:number}}
     * @memberof FileStreamAbstract
     * @abstract
     * @public
     */
    static getStat(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Currently mobile only.
     * @returns Promise<string[]> - array of absolute paths to cached items.
     * @static
     * @memberof FileStreamAbstract
     * @abstract
     * @public
     */
    static getCacheList() {
        throw new AbstractCallError();
    }

    /**
     * Override. Removes file by path.
     * @static
     * @param {string} path
     * @returns {Promise}
     * @memberof FileStreamAbstract
     * @abstract
     * @public
     */
    static delete(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Renames old path to new path.
     * @static
     * @param {string} oldPath
     * @param {string} newPath
     * @returns {Promise}
     * @memberof FileStreamAbstract
     * @abstract
     * @public
     */
    static rename(oldPath, newPath) {
        throw new AbstractCallError();
    }

    /**
     * Override. Returns a path for storing temporarily downloaded(cached) files.
     * @static
     * @memberof FileStreamAbstract
     */
    static getTempCachePath(name) {
        throw new AbstractCallError();
    }

    /**
     * Override. Creates a directory at "path".
     * @static
     * @memberof FileStreamAbstract
     */
    static createDir(path) {
        throw new AbstractCallError();
    }

    /**
     * Override. Empties and them removes a directory at "path".
     * @static
     * @memberof FileStreamAbstract
     */
    static removeDir(path) {
        throw new AbstractCallError();
    }
}

module.exports = FileStreamAbstract;
