const secret = require('../crypto/secret');
const util = require('../crypto/util');

/**
 * TinyDbCollection is a named local storage for small amounts of data
 * like user preferences and flags.
 * @param {string} name - collection name
 * @param {Uint8Array} [encryptionKey] - encryption key
 * @param {StorageEngineConstructor} - constructor for storage engine
 */
class TinyDbCollection {
    constructor(engine, name, encryptionKey) {
        this.engine = engine;
        this.name = name;
        this.encryptionKey = encryptionKey;
    }

    /**
     * @param {string} valueString
     * @returns {string} ciphertext
     * @private
     */
    encrypt = (valueString) => {
        if (!this.encryptionKey) return valueString;
        const buf = secret.encryptString(valueString, this.encryptionKey);
        return util.bytesToB64(buf);
    };

    /**
     * @param {string} ciphertext
     * @returns {string}
     * @private
     */
    decrypt = (ciphertext) => {
        if (ciphertext == null) return null;
        if (!this.encryptionKey) return ciphertext;
        const buf = util.b64ToBytes(ciphertext);
        return secret.decryptString(buf, this.encryptionKey);
    };

    /**
     * Gets a value from TinyDbCollection.
     * @param {string} key
     * @returns {Promise<any>} - JSON.parse() result of retrieved value
     * @public
     */
    getValue(key) {
        if (!key) return Promise.reject(new Error('Invalid TinyDb key'));
        return this.engine.getValue(key)
            .then(this.decrypt)
            .then(JSON.parse)
            .catch(err => {
                console.error(err);
                return null;
            });
    }

    /**
     * Stores a value in TinyDbCollection.
     * @param {string} key
     * @param {any} value - will be serialized with JSON.stringify() before storing.
     * @returns {Promise}
     * @public
     */
    setValue(key, value) {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        let val = JSON.stringify(value == null ? null : value);
        val = this.encrypt(val);
        return this.engine.setValue(key, val);
    }

    /**
     * Removes value from TinyDbCollection.
     * @param {string} key
     * @returns {Promise}
     * @public
     */
    removeValue(key) {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        return this.engine.removeValue(key);
    }

    /**
     * Returns a list of all keys in TinyDbCollection.
     * @returns {Promise<string[]>}
     * @public
     */
    getAllKeys() {
        return this.engine.getAllKeys();
    }

    /**
     * Clears all TinyDbCollection values.
     * @public
     */
    clear() {
        return this.engine.clear();
    }
}

module.exports = TinyDbCollection;
