import KegDb from './keg-db';

const { observable, when } = require('mobx');

const Keg = require('./keg');
const util = require('../../crypto/util');

/**
 * Named plaintext Boot keg for 'SELF' databases.
 */
export default class BootKeg extends Keg {
    @observable.shallow keys = {};
    kegKey;
    kegKeyId = '0';

    constructor(db: KegDb, bootKey: Uint8Array) {
        // named kegs are pre-created, so we know the id already and only going to update boot keg
        super('boot', 'boot', db);
        this.overrideKey = bootKey;
        this.version = 1; // pre-created named keg
    }

    /**
     * Waits until keyId is available and resolves with it.
     * If the key will not appear in the timeout time, resolves to undefined.
     */
    async getKey(keyId: string, timeout = 120000) {
        if (this.keys[keyId]) {
            // quick path
            return this.keys[keyId];
        }
        let resolve;
        const promise = new Promise(_resolve => {
            resolve = _resolve;
        });
        const disposeReaction = when(() => this.keys[keyId], resolve);
        await promise.timeout(timeout).catch(() => {
            disposeReaction();
        });
        return this.keys[keyId];
    }

    deserializeKegPayload(data) {
        /**
         * @type {KeyPair}
         */
        this.signKeys = {};
        this.signKeys.publicKey = util.b64ToBytes(data.signKeys.publicKey);
        this.signKeys.secretKey = util.b64ToBytes(data.signKeys.secretKey);
        /**
         * @type {KeyPair}
         */
        this.encryptionKeys = {};
        this.encryptionKeys.publicKey = util.b64ToBytes(
            data.encryptionKeys.publicKey
        );
        this.encryptionKeys.secretKey = util.b64ToBytes(
            data.encryptionKeys.secretKey
        );
        /**
         * @type {Uint8Array}
         */
        this.kegKey = util.b64ToBytes(data.kegKey);
        this.keys[this.kegKeyId] = { key: this.kegKey, createdAt: Date.now() };
    }

    serializeKegPayload() {
        return {
            signKeys: {
                publicKey: util.bytesToB64(this.signKeys.publicKey),
                secretKey: util.bytesToB64(this.signKeys.secretKey)
            },
            encryptionKeys: {
                publicKey: util.bytesToB64(this.encryptionKeys.publicKey),
                secretKey: util.bytesToB64(this.encryptionKeys.secretKey)
            },
            kegKey: util.bytesToB64(this.kegKey)
        };
    }
}
