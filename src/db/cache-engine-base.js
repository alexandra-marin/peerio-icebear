const { observable } = require('mobx');
const { asPromise } = require('../helpers/prombservable');
const { simpleHash } = require('../util');
const config = require('../config');
const { getUser } = require('../helpers/di-current-user');
const TinyDb = require('../db/tiny-db');

/**
 * @callback CacheEngineBase~cacheUpdateCallback
 * @param {object} oldValue
 * @param {object} newValue
 * @returns {object | false} object - write this object, false - don't write anything
 */

const META_DB_NAME = 'peerio_cache_meta';

// Increment this to reset cache in the next release
const CACHE_RESET_COUNTER = 3;

const CACHE_RESET_KEY = 'cacheResetCounter';

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
    // exists and resolved if we already checked if cache needs resetting and did the reset (if needed)
    static cacheResetPromise;

    /**
     * Resets cache between releases if cache-breaking changes have been introduced or bugs found
     */
    static async resetCacheIfNeeded() {
        // no action taken if we already ensured the correct version
        // otherwise returning same promise to prevent race condition with multiple databases being open
        if (CacheEngineBase.cacheResetPromise) {
            return CacheEngineBase.cacheResetPromise;
        }
        let resolve;
        CacheEngineBase.cacheResetPromise = new Promise(r => {
            resolve = r;
        });
        const version = await TinyDb.system.getValue(CACHE_RESET_KEY);
        try {
            if (version === CACHE_RESET_COUNTER) {
                console.log('Cache reset not needed.');
            } else {
                console.log(`Cache reset is required. Resetting...`);
                await CacheEngineBase.clearAllCache();
                await TinyDb.system.setValue(
                    CACHE_RESET_KEY,
                    CACHE_RESET_COUNTER
                );
                console.log('Finished cache reset.');
            }
        } catch (e) {
            console.error(e);
            console.error('Failed to process cache reset.');
        }
        // resolving even in case of error hoping that app can continue,
        // otherwise everything relying on cache will just wait forever
        resolve();
        return null;
    }

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

    async open() {
        // not the best design, if we invoke reset for meta db it's gonna lock,
        // but meta db is meta db, it's not a regular db, so it can have exceptions
        if (this.name !== META_DB_NAME) {
            await CacheEngineBase.resetCacheIfNeeded();
        }
        await this.openInternal();
        this.isOpen = true;
    }

    /**
     * Ensures database is open and ready (in case of async).
     * @returns {Promise}
     */
    openInternal() {
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
