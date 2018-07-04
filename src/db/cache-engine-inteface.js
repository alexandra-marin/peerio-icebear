/* eslint-disable */
// This file exists just for the sake of documentation.
// CacheEngineInterface class is never used.

/**
 * @callback CacheEngineInterface~cacheUpdateCallback
 * @param {object} oldValue
 * @param {object} newValue
 * @returns {bool} True - update, False - don't
 */

/**
 * @interface CacheEngineInterface
 */
class CacheEngineInterface {
    constructor(namespace) { }

    /**
     * Ensures database is open and ready (in case of async).
     * @returns {Promise}
     */
    open() { }

    /**
     * Asynchronously gets a value from storage.
     * @param {string} key
     * @returns {Promise<string>} - strictly `null` if key or value doesn't exist. TinyDb stores only strings,
     * so any other return type is an error.
     */
    getValue(key) { }

    /**
     * Asynchronously saves a value to storage.
     * @param {string} key - if key already exists - overwrite.
     * @param {string} value - TinyDb will serialize any value to string before saving it.
     * @callback {[cacheUpdateCallback]} confirm - a callback to confirm update if value already exists
     *                                           this should be done in atomic/transactional way.
     * @returns {Promise}
     */
    setValue(key, value, confirmUpdate) { }

    /**
     * Asynchronously removes key/value from store.
     * @param {string} key - if key doesn't exist, just resolve promise.
     * @returns {Promise}
     */
    removeValue(key) { }

    /**
     * Asynchronously retrieves a list of all keys in current namespace
     * @returns {Promise<string[]>}
     */
    getAllKeys() { }

    /**
     * Asynchronously retrieves a list of all values in current namespace
     * @returns {Promise<string[]>}
     */
    getAllValues() { }

    /**
     * Removes all data from current namespace.
     */
    clear() { }
}
