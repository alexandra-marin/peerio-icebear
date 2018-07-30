const { observable } = require('mobx');
const { asPromise } = require('../helpers/prombservable');
const { simpleHash } = require('../util');
const config = require('../config');
const { getUser } = require('../helpers/di-current-user');

/**
 * @callback CacheEngineBase~cacheUpdateCallback
 * @param {object} oldValue
 * @param {object} newValue
 * @returns {object | false} object - write this object, false - don't write anything
 */

const META_DB_NAME = 'peerio_cache_meta';
/**
 * CacheEngineBase
 */
class CacheEngineBase {
    /**
     * @param {string} shortName - unique(per user) database short name (will be converted to longer and safer name)
     * @param {string} keyPath - how to find the key in saved objects
     */
    constructor(shortName, keyPath) {
        if (!shortName || !keyPath) throw new Error('Invalid arguments');
        this.name =
            shortName === META_DB_NAME
                ? META_DB_NAME
                : CacheEngineBase.getCacheDbFullName(shortName);
        this.keyPath = keyPath;

        if (shortName !== META_DB_NAME) CacheEngineBase.saveDbName(this.name);
    }

    static metaDb;

    static async clearAllCache() {
        await CacheEngineBase.openMetaDatabase();
        const databases = await CacheEngineBase.metaDb.getAllKeys();
        for (let i = 0; i < databases.length; i++) {
            await CacheEngineBase.metaDb.deleteDatabase(databases[i]);
        }
        return CacheEngineBase.metaDb.clear();
    }

    static getCacheDbFullName(name) {
        const prefix = 'peerio'; // something to separate our databases in case they're in global scope
        const username = getUser().username; // separate user spaces
        const server = simpleHash(config.socketServerUrl); // during dev and testing different servers can happen
        return `${prefix}_${username}_${name}_cache_${server}`;
    }

    static async openMetaDatabase() {
        if (!CacheEngineBase.metaDb) {
            CacheEngineBase.metaDb = new config.CacheEngine(
                META_DB_NAME,
                'name'
            );
            return CacheEngineBase.metaDb.open();
        }
        if (!CacheEngineBase.metaDb.isOpen) {
            return asPromise(CacheEngineBase.metaDb, 'isOpen', true);
        }
        return null;
    }

    static async saveDbName(name) {
        await CacheEngineBase.openMetaDatabase();
        return CacheEngineBase.metaDb.setValue(name, {
            name,
            owner: getUser().username
        });
    }

    static async removeDbName(name) {
        await CacheEngineBase.openMetaDatabase();
        return CacheEngineBase.metaDb.removeValue(name);
    }

    /**
     * {boolean}
     */
    @observable isOpen;

    /**
     * Ensures database is open and ready (in case of async).
     * (!) In your implementation, please set this.isOpen = true on success.
     * @returns {Promise}
     */
    open() {
        throw new Error('Method not implemented');
    }

    /**
     * Asynchronously gets a value from storage.
     * @param {string} key
     * @returns {Promise<Object>}
     */
    // eslint-disable-next-line no-unused-vars
    getValue(key) {
        throw new Error('Method not implemented');
    }

    /**
     * Asynchronously saves a value to storage.
     * @param {string} key - if key already exists - overwrite value
     * @param {object} value
     * @callback {[cacheUpdateCallback]} confirm - a callback to confirm update if value already exists
     *                                             read and write should be done in atomic/transactional way.
     * @returns {Promise}
     */
    // eslint-disable-next-line no-unused-vars
    setValue(key, value, confirmUpdate) {
        throw new Error('Method not implemented');
    }

    /**
     * Asynchronously removes key/value from store.
     * @param {string} key - if key doesn't exist, just resolve promise.
     * @returns {Promise}
     */
    // eslint-disable-next-line no-unused-vars
    removeValue(key) {
        throw new Error('Method not implemented');
    }

    /**
     * Asynchronously retrieves a list of all keys in current namespace
     * @returns {Promise<string[]>}
     */
    getAllKeys() {
        throw new Error('Method not implemented');
    }

    /**
     * Asynchronously retrieves a list of all values in current namespace
     * @returns {Promise<string[]>}
     */
    getAllValues() {
        throw new Error('Method not implemented');
    }

    /**
     * Removes all data from current database.
     * @returns {Promise}
     */
    clear() {
        throw new Error('Method not implemented');
    }

    /**
     * Deletes any database by name
     * @param {string} fullName
     */
    // eslint-disable-next-line no-unused-vars
    deleteDatabase(fullName) {
        throw new Error('Method not implemented');
    }
}

module.exports = CacheEngineBase;
