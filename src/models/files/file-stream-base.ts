/* eslint-disable no-unused-vars */
import { AbstractCallError } from '~/errors';
/**
 * Abstract File Stream class. Icebear wants to read/write files,
 * but doesn't know how exactly that would work on your platform.
 *
 * 1. create you own class and inherit from FileStreamBase.
 * 2. override required functions.
 * 3. set config.FileStream = YourFileStreamImplementation.
 */
class FileStreamBase {
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

    filePath: string;
    mode: string;
    /**
     * File stream pointer
     */
    pos: number;

    /**
     * Reads a chunk of data from file stream.
     * @param size - amount of bytes to read (if possible)
     * @return resolves with a number of bytes written to buffer
     */
    read = (size: number) => {
        if (this.mode !== 'read') {
            return Promise.reject(new Error('Attempt to read from write stream.'));
        }
        return this.readInternal(size).then(this._increasePosition);
    };

    _increasePosition = (buf: Uint8Array) => {
        this.pos += buf.length;
        return buf;
    };

    /**
     * Override this in your implementation.
     * @param size - bytes
     */
    readInternal(_size: number): Promise<Uint8Array> {
        throw new AbstractCallError();
    }

    /**
     * Writes a chunk of data to file stream
     */
    write = async (buffer: Uint8Array): Promise<void> => {
        if (this.mode !== 'write' && this.mode !== 'append') {
            throw new Error(`file-stream.js: Attempt to write to read stream. ${this.mode}`);
        }
        if (!buffer || !buffer.length) return;
        await this.writeInternal(buffer);
        await this._increasePosition(buffer);
    };

    /**
     * Override this in your implementation.
     * @returns buffer, same one as was passed
     */
    writeInternal(_buffer: Uint8Array): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Move file position pointer.
     * @returns new position
     */
    seek = (pos: number): void => {
        if (this.mode !== 'read') throw new Error('Seek only on read streams');
        this.seekInternal(pos);
    };

    /**
     * Override this in your implementation. Move file position pointer.
     * @returns new position
     */
    seekInternal(_pos: number): void {
        throw new AbstractCallError();
    }

    /**
     * Override. This function has to set 'size' property.
     */
    open(): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Called when done working with file, should flush all buffers and dispose resources.
     */
    close(): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Returns full path for file when there's a default cache path implemented in the app.
     * Currently only mobile.
     * @param uid - unique identifier
     * @param name - human-readable file name
     * @returns actual device path for file
     */
    static getFullPath(_uid: string, _name: string): string {
        throw new AbstractCallError();
    }

    /**
     * Override.
     * @returns true if path exists on device
     */
    static exists(_path: string): Promise<boolean> {
        throw new AbstractCallError();
    }

    /**
     * Override. Launch external viewer.
     * @param path - file path to open in a viewer.
     */
    static launchViewer(_path: string): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Get file stat object.
     */
    static getStat(_path: string): Promise<{ size: number }> {
        throw new AbstractCallError();
    }

    /**
     * Override. Currently mobile only.
     * @returns array of absolute paths to cached items.
     */
    static getCacheList(): Promise<string[]> {
        throw new AbstractCallError();
    }

    /**
     * Override. Removes file by path.
     */
    static delete(_path: string): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Renames old path to new path.
     */
    static rename(_oldPath: string, _newPath: string): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Returns a path for storing temporarily downloaded(cached) files.
     */
    static getTempCachePath(_name: string): string {
        throw new AbstractCallError();
    }

    /**
     * Override. Creates a directory at "path".
     */
    static createDir(_path: string): Promise<void> {
        throw new AbstractCallError();
    }

    /**
     * Override. Empties and them removes a directory at "path".
     */
    static removeDir(_path: string): Promise<void> {
        throw new AbstractCallError();
    }
}

export default FileStreamBase;
