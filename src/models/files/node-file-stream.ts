import FileStreamAbstract from './file-stream-abstract';
import errors from '../../errors';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

/**
 * FileStreamAbstract implementation for nodejs, see {@link FileStreamAbstract} for docs.
 * @extends {FileStreamAbstract}
 */
class NodeFileStream extends FileStreamAbstract {
    checkForError(err, rejectFn) {
        if (err) {
            rejectFn(errors.normalize(err));
            return true;
        }
        return false;
    }

    open() {
        this.nextReadPos = null;
        return new Promise((resolve, reject) => {
            fs.open(this.filePath, this.mode[0], (err, fd) => {
                if (this.checkForError(err, reject)) return;
                this.fileDescriptor = fd;
                fs.fstat(fd, (sErr, stat) => {
                    if (this.checkForError(sErr, reject)) return;
                    this.size = stat.size;
                    resolve(this);
                });
            });
        });
    }

    close() {
        if (this.fileDescriptor == null || this.closed) return Promise.resolve();
        this.closed = true;
        return new Promise((resolve, reject) => {
            fs.close(this.fileDescriptor, err => {
                if (this.checkForError(err, reject)) return;
                resolve();
            });
        });
    }

    readInternal(size) {
        return new Promise((resolve, reject) => {
            const buffer = new Uint8Array(size);
            fs.read(
                this.fileDescriptor,
                Buffer.from(buffer.buffer),
                0,
                size,
                this.nextReadPos,
                (err, bytesRead) => {
                    if (this.checkForError(err, reject)) return;
                    if (this.nextReadPos != null) this.nextReadPos += bytesRead;
                    if (bytesRead < buffer.length) {
                        resolve(buffer.subarray(0, bytesRead));
                    } else {
                        resolve(buffer);
                    }
                }
            );
        });
    }

    writeInternal(buffer) {
        return new Promise((resolve, reject) => {
            fs.write(this.fileDescriptor, Buffer.from(buffer), 0, buffer.length, null, err => {
                if (this.checkForError(err, reject)) return;
                resolve(buffer);
            });
        });
    }

    seekInternal(pos) {
        this.nextReadPos = pos;
        this.pos = pos;
    }

    static getStat(filePath) {
        try {
            const stat = fs.statSync(filePath);
            return Promise.resolve(stat);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    static delete(filePath) {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static rename(oldPath, newPath) {
        return new Promise((resolve, reject) => {
            fs.rename(oldPath, newPath, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static getTempCachePath(name) {
        if (!this.storageFolder) {
            throw new Error('Must set FileStream.storageFolder');
        }
        return path.join(this.storageFolder, name);
    }

    static exists(filePath) {
        return Promise.resolve(fs.existsSync(filePath));
    }

    static createDir(folderPath) {
        return new Promise((resolve, reject) => {
            mkdirp(folderPath, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static removeDir(folderPath) {
        return new Promise((resolve, reject) => {
            rimraf(folderPath, { disableGlob: true }, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    static async createTempCache() {
        console.log(`Initializing temporary path ${this.storageFolder}`);
        try {
            await this.createDir(this.storageFolder);
            console.log(`Successfully set TMP ROOT to ${this.storageFolder}`);
        } catch (e) {
            console.error(e);
        }
    }

    static deleteTempCache() {
        console.log(`Deleting temporary path ${this.storageFolder}`);
        return this.removeDir(this.storageFolder).catch(e => void console.error(e));
    }
}

export default NodeFileStream;
