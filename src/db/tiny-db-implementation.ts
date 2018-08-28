import * as secret from '~/crypto/secret';
import * as util from '~/crypto/util';
import { TinyDBStorageEngine } from '~/defs/tiny-db';

/**
 * TinyDbImplementation is a named local storage for small amounts of data
 * like user preferences and flags.
 */
class TinyDbImplementation {
    constructor(engine: TinyDBStorageEngine, name: string, encryptionKey?: Uint8Array) {
        this.engine = engine;
        this.name = name;
        this.encryptionKey = encryptionKey;
    }

    engine: TinyDBStorageEngine;
    name: string;
    encryptionKey: Uint8Array | null;

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
     * Gets a value from TinyDbImplementation.
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
     * Stores a value in TinyDbImplementation.
     * @param value - will be serialized with JSON.stringify() before storing.
     */
    setValue(key: string, value: any) {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        let val = JSON.stringify(value == null ? null : value);
        val = this.encrypt(val);
        return this.engine.setValue(key, val);
    }

    /**
     * Removes value from TinyDbImplementation.
     */
    removeValue(key: string) {
        if (!key) return Promise.reject(new Error('Invalid tinydb key'));
        return this.engine.removeValue(key);
    }

    /**
     * Returns a list of all keys in TinyDbImplementation.
     */
    getAllKeys() {
        return this.engine.getAllKeys();
    }

    /**
     * Clears all TinyDbImplementation values.
     */
    clear() {
        return this.engine.clear();
    }
}

export default TinyDbImplementation;
