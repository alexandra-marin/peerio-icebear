const Keg = require('./../kegs/keg');
const { AntiTamperError } = require('../../errors');


/**
 * Tofu keg.
 * @param {KegDb} db
 * @extends {Keg}
 */
class Tofu extends Keg {
    constructor(db) {
        super(null, 'tofu', db);
    }

    /**
     * @member {string}
     */
    username;
    /**
     * @member {string}
     */
    firstName;
    /**
     * @member {string}
     */
    lastName;
    /**
     * @member {Uint8Array}
     */
    encryptionPublicKey;
    /**
     * @member {Uint8Array}
     */
    signingPublicKey;

    serializeKegPayload() {
        return {
            username: this.username,
            firstName: this.firstName,
            lastName: this.lastName,
            encryptionPublicKey: this.encryptionPublicKey,
            signingPublicKey: this.signingPublicKey
        };
    }

    deserializeKegPayload(payload) {
        this.firstName = payload.firstName;
        this.lastName = payload.lastName;
        this.encryptionPublicKey = payload.encryptionPublicKey;
        this.signingPublicKey = payload.signingPublicKey;
    }

    serializeProps() {
        return { username: this.username };
    }

    deserializeProps(props) {
        this.username = props.username;
    }

    detectTampering(payload) {
        super.detectTampering(payload);
        if (payload.username !== this.username) {
            throw new AntiTamperError('Tofu keg inner and outer username mismatch. '
                + `Inner: ${payload.username}. Outer: ${this.username}`);
        }
    }
}

module.exports = Tofu;
