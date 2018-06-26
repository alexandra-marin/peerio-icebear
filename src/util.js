/**
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

module.exports = { convertBuffers, formatBytes, tryToGet };

