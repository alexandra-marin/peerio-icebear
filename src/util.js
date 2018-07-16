const { getUser } = require('./helpers/di-current-user');
const config = require('./config');

/*
 * Various utility functions that didn't fit anywhere else.
 */


/**
 * Finds all ArrayBuffer type properties recursively and changes them to Uint8Array created with the same ArrayBuffer.
 * @param {Object} obj - object to check for ArrayBuffers.
 * @returns {Object} same object that was passed but with some property values changed.
 */
function convertBuffers(obj) {
    if (typeof (obj) !== 'object') return obj;

    for (const prop in obj) {
        const type = typeof (obj[prop]);
        if (type !== 'object') {
            continue;
        }
        if (obj[prop] instanceof ArrayBuffer) {
            obj[prop] = new Uint8Array(obj[prop]);
        } else {
            convertBuffers(obj[prop]);
        }
    }
    return obj;
}

/**
 * Converts bytes number to human-readable string format.
 * @param {number} bytes
 * @returns {string} formatted string.
 * @example
 * formatBytes(1024); // returns '1 KB'
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    else if (bytes < 1048576) return `${+(bytes / 1024).toFixed(2)} KB`;
    else if (bytes < 1073741824) return `${+(bytes / 1048576).toFixed(2)} MB`;
    return `${+(bytes / 1073741824).toFixed(2)} GB`;
}

/**
 * Tries to get a value. If it fails, returns default value or undefined.
 * Do not use this in performance critical cases because of deliberate exception throwing
 * @param {function} fn Functor, which may throw exception in which case default value will be used.
 * @returns {any} Result of fn execution, if it didn't throw exception, or defaultValue
 */
function tryToGet(fn, defaultValue) {
    try {
        return fn();
    } catch (e) {
        // console.error(e);
    }
    return defaultValue;
}


function getCacheDbFullName(name) {
    if (!name) throw new Error('Cache database has to have a name');
    const prefix = 'peerio'; // something to separate our databases in case they're in global scope
    const username = getUser().username; // separate user spaces
    const server = simpleHash(config.socketServerUrl); // during development and testing different servers can happen
    return `${prefix}_${username}_${name}_cache_${server}`;
}

function simpleHash(str) {
    let hash = 0;
    if (!str.length) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash &= hash; // Convert to 32bit integer
    }
    return hash;
}
module.exports = { convertBuffers, formatBytes, tryToGet, getCacheDbFullName };

