//
// Hashing part of Peerio crypto utilities module.
//

const BLAKE2s = require('blake2s-js');
const { getScrypt } = require('./scrypt-proxy');
const convert = require('./util.conversion');
const padding = require('./util.padding');

/**
 * Hashes a value and returns BLAKE2s object.
 * @param {number} length - hash length 1-32
 * @param {Uint8Array} value - value to hash
 * @param {string} [personalizationString]
 * @returns {BLAKE2s}
 * @memberof crypto/util
 * @private
 */
function getHashObject(length, value, personalizationString) {
    const personalization = personalizationString
        ? { personalization: padding.padBytes(convert.strToBytes(personalizationString), 8) }
        : undefined;
    const h = new BLAKE2s(length, personalization);
    h.update(value);
    return h;
}

/**
 * Hashes a value and returns hex string.
 * @param {number} length - hash length 1-32
 * @param {Uint8Array} value - value to hash
 * @param {string} [personalizationString]
 * @returns {string} - hex encoded hash
 * @memberof crypto/util
 * @public
 */
function getHexHash(length, value, personalizationString) {
    return getHashObject(length, value, personalizationString).hexDigest();
}

/**
 * Hashes a value and returns hash bytes.
 * @param {number} length - hash length 1-32
 * @param {Uint8Array} value - value to hash
 * @param {string} [personalizationString]
 * @returns {Uint8Array} - hash bytes
 * @memberof crypto/util
 * @public
 */
function getByteHash(length, value, personalizationString) {
    return getHashObject(length, value, personalizationString).digest();
}

/**
 * Returns user fingerprint string.
 * @param {string} username
 * @param {Uint8Array} publicKey
 * @returns {Promise<string>} fingerprint. Example: `51823-23479-94038-76454-79776-13778`
 * @memberof crypto/util
 * @public
 */
function getFingerprint(username, publicKey) {
    const scrypt = getScrypt();
    return new Promise(resolve => {
        scrypt(publicKey, convert.strToBytes(username), { N: 4096, r: 8, dkLen: 24, encoding: 'binary' }, resolve);
    }).then(fingerprintToStr);
}

/**
 * Converts fingerprint bytes to string representation.
 * @param {Uint8Array} bytes
 * @returns {string} fingerprint. Example: `51823-23479-94038-76454-79776-13778`
 * @memberof crypto/util
 * @private
 */
function fingerprintToStr(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const c = [];
    for (let i = 0; i < bytes.length; i += 4) {
        c.push((`00000${v.getUint32(i) % 100000}`).slice(-5));
    }
    return c.join('-');
}

module.exports = {
    getHashObject,
    getHexHash,
    getByteHash,
    getFingerprint
};
