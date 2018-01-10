const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

/**
 * Synchronously deletes file at the given path.
 */
const deleteFile = filename => {
    try {
        fs.unlinkSync(filename);
    } catch (err) {
        console.error(`Failed to delete ${filename}`);
        console.error(err);
    }
};

/**
 * Returns a new random temporary file name in the temporary directory.
 *
 * @param {string} [suffix] optional file suffix ('.tmp' by default)
 * @returns {string}
 */
const getTempFileName = (suffix = '.tmp') => {
    return path.join(os.tmpdir(), crypto.randomBytes(10).toString('hex') + suffix);
};

/**
 * Creates a temporary file filled random data and
 * returns an object containing file name and hex-encoded
 * SHA-1 hash of the file.
 *
 * @param {number} length file length in bytes
 * @param {string} [suffix] optional file suffix ('.tmp' by default)
 * @returns {Promise<string>} file name
 */
const createRandomTempFile = async (length, suffix) => {
    const name = getTempFileName(suffix);
    const fd = await fs.openAsync(name, 'w');

    try {
        while (length > 0) {
            const chunk = crypto.randomBytes(Math.min(length, 4096));
            await fs.writeAsync(fd, chunk); // eslint-disable-line no-await-in-loop
            length -= chunk.length; // eslint-disable-line no-param-reassign
        }
    } catch (err) {
        deleteFile(name);
    } finally {
        await fs.closeAsync(fd);
    }

    return name;
};

// Reads from file until the buffer is filled.
async function readAll(fd, buffer) {
    let pos = 0;
    let left = buffer.length;
    while (left > 0) {
        const bytesRead = fs.readSync(fd, buffer, pos, buffer.length - pos); // eslint-disable-line
        // XXX: readAsync freezes ¯\_(ツ)_/¯
        // const bytesRead = await fs.readAsync(fd, buffer, pos, buffer.length - pos); // eslint-disable-line
        if (bytesRead === 0) {
            throw new Error('Unexpected end of file');
        }
        left -= bytesRead;
        pos += bytesRead;
    }
}

/**
 * Returns true if files have the same contents,
 * false otherwise.
 *
 * @param {string} filename1 first file path
 * @param {string} filename2 second file path
 * @returns Promise<boolean>
 */
const filesEqual = async (filename1, filename2) => {
    let fd1, fd2;
    try {
        fd1 = await fs.openAsync(filename1, 'r');
        fd2 = await fs.openAsync(filename2, 'r');

        // Compare file sizes.
        const fi1 = await fs.fstatAsync(fd1);
        const fi2 = await fs.fstatAsync(fd2);
        if (fi1.size !== fi2.size) return false;

        // Compare contents.
        const buf1 = Buffer.alloc(fi1.blksize);
        const buf2 = Buffer.alloc(buf1.length);
        let left = fi1.size;
        while (left > 0) {
            const chunkSize = Math.min(left, buf1.length);
            const data1 = buf1.slice(0, chunkSize);
            const data2 = buf2.slice(0, chunkSize);
            await readAll(fd1, data1); // eslint-disable-line no-await-in-loop
            await readAll(fd2, data2); // eslint-disable-line no-await-in-loop
            if (!data1.equals(data2)) return false;
            left -= chunkSize;
        }
        return true;
    } finally {
        if (fd1) await fs.closeAsync(fd1);
        if (fd2) await fs.closeAsync(fd2);
    }
};

module.exports = {
    getTempFileName,
    createRandomTempFile,
    deleteFile,
    filesEqual
};
