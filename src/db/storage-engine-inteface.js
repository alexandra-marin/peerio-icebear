/* eslint-disable */
// This file exists just for the sake of documentation.
// StorageEngineInterface class is never used.

/**
 * This is a contract for the actual client-specific StorageEngine client has to implement and set to config module.
 * TinyDb will get the implementation from config module and use it.
 * @param {string} namespace - unique namespace will be passed to storage engine when instantiating.
 * Values in current instance should be stored under that unique namespace.
 * @interface StorageEngineInterface
 */
class StorageEngineInterface {
    constructor(namespace) { }

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
     * @returns {Promise}
     */
    setValue(key, value) { }

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
     * Removes all data from current namespace.
     */
    clear() { }
}
