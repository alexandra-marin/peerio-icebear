import * as secret from '../crypto/secret';
import * as util from '../crypto/util';

/**
 * TinyDbCollection is a named local storage for small amounts of data
 * like user preferences and flags.
 * @param name - collection name
 */
class TinyDbCollection {
    constructor(engine: StorageEngineConstructor, name: string, encryptionKey?: Uint8Array) {
        this.engine = engine;
        this.name = name;
        this.encryptionKey = encryptionKey;
    }

    encrypt = (valueString: string): string => {
        if (!this.encryptionKey) return valueString;
        const buf = secret.encryptString(valueString, this.encryptionKey);
        return util.bytesToB64(buf);
    };

    decrypt = (ciphertext: string): string => {
        if (ciphertext == null) return null;
        if (!this.encryptionKey) return ciphertext;
        const buf = util.b64ToBytes(ciphertext);
        return secret.decryptString(buf, this.encryptionKey);
    };

    /**
     * Gets a value from TinyDbCollection.
     * @returns JSON.parse(retrieved value)
     */
    getValue(key: string): Promise<any> {
        if (!key) return Promise.reject(new Error('Invalid TinyDb key'));
        return this.engine
            .getValue(key)
            .then(this.decrypt)
            .then(JSON.parse)
            .catch(err => {
                console.error(err);
                return null;
            });
    }

    /**
     * Stores a value in TinyDbCollection.
     * @param value - will be serialized with JSON.stringify() before storing.
     */
    setValue(key: string, value: any): Promise {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        let val = JSON.stringify(value == null ? null : value);
        val = this.encrypt(val);
        return this.engine.setValue(key, val);
    }

    /**
     * Removes value from TinyDbCollection.
     */
    removeValue(key: string): Promise {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        return this.engine.removeValue(key);
    }

    /**
     * Returns a list of all keys in TinyDbCollection.
     */
    getAllKeys(): string[] {
        return this.engine.getAllKeys();
    }

    /**
     * Clears all TinyDbCollection values.
     */
    clear() {
        return this.engine.clear();
    }
}

export default TinyDbCollection;
