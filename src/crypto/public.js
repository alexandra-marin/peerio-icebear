/**
 * Public key encryption module
 */

const nacl = require('tweetnacl');
const secret = require('./secret');
const { DecryptionError } = require('../errors');

/**
 * This is a classic variant of decryption function for server compatibility.
 * It's used for decrypting authTokens and other tokens. For everything else client uses optimized version
 * {@link decrypt}
 * @param {Uint8Array} cipher - encrypted bytes
 * @param {Uint8Array} nonce - 24 byte nonce
 * @param {Uint8Array} theirPublicKey - message sender's public key
 * @param {Uint8Array} mySecretKey - decrypting user's secret key
 * @returns {Uint8Array}  decrypted bytes
 */
function decryptCompat(cipher, nonce, theirPublicKey, mySecretKey) {
    const decrypted = nacl.box.open(cipher, nonce, theirPublicKey, mySecretKey);
    if (decrypted === null) throw new DecryptionError();
    // underlying buffer is > then ciphertext, this can lead to numerous bugs, so we slice it
    return decrypted.slice();
}

/**
 * Encrypt using public key crypto.
 * WARNING: this function is ok to use for occasional operations, but for performance-critical parts it's better
 * to use crypto/secret.encrypt {@link crypto/secret:encrypt} with precalculated shared key from User class {@link User}
 * @param {Uint8Array} msgBytes - unencrypted message
 * @param {Uint8Array} theirPublicKey - message recipient's public key
 * @param {Uint8Array} mySecretKey - encrypting user's secret key
 * @returns {Uint8Array} encrypted bytes
 */
function encrypt(msgBytes, theirPublicKey, mySecretKey) {
    const sharedKey = nacl.box.before(theirPublicKey, mySecretKey);
    return secret.encrypt(msgBytes, sharedKey);
}

/**
 * Decrypt using public key crypto.
 * WARNING: this function is ok to use for occasional operations, but for performance-critical parts it's better
 * to use crypto/secret.encrypt {@link crypto/secret:encrypt} with precalculated shared key from User class {@link User}
 * @param {Uint8Array} cipher - encrypted bytes
 * @param {Uint8Array} theirPublicKey - message sender's public key
 * @param {Uint8Array} mySecretKey - decrypting user's secret key
 * @returns {Uint8Array} decrypted bytes
 */
function decrypt(cipher, theirPublicKey, mySecretKey) {
    const sharedKey = nacl.box.before(theirPublicKey, mySecretKey);
    return secret.decrypt(cipher, sharedKey);
}

/**
 * Calculates shared key for public key crypto.
 * @param {Uint8Array} theirPublicKey - other user's public key
 * @param {Uint8Array} mySecretKey - current user's secret key
 * @returns {Uint8Array} 32 bytes shared key
 */
const computeSharedKey = nacl.box.before;

module.exports = { decryptCompat, encrypt, decrypt, computeSharedKey };
