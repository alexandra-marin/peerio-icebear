/**
 * Peerio Crypto module for key handling.
 * @module crypto/keys
 * @public
 */
const { getScrypt } = require('./scrypt-proxy');
const BLAKE2s = require('blake2s-js');
const nacl = require('tweetnacl');
const util = require('./util');
const errors = require('../errors');

// ------------------------------------------------------------------------------------------
// WARNING: changing scrypt params will break compatibility with older scrypt-generated data
// ------------------------------------------------------------------------------------------
let SCRYPT_N = 16384;
try {
    if (process.env.PEERIO_REDUCE_SCRYPT_FOR_TESTS) {
        console.log('TEST ENVIRONMENT DETECTED. SCRYPT WILL USE REDUCED COMPLEXITY FOR PERFORMANCE BOOST.');
        SCRYPT_N = 1024;
    }
} catch (ex) {
    //  meh
}

/**
 * Promisified scrypt call.
 * @param {string|Uint8Array|Array} value - the value that needs to be hashed
 * @param {string|Uint8Array|Array} salt
 * @param {Object} options - scrypt options, see {@link https://github.com/dchest/scrypt-async-js#options}
 * @returns {Promise<Uint8Array>} hashed value
 * @memberof crypto/keys
 * @private
 */
function scryptPromise(value, salt, options) {
    return new Promise(resolve => {
        getScrypt()(value, salt, options, resolve);
    });
}

/**
 * Prehashes secret for stronger key derivation.
 * @param {string} value - passphrase or other secret
 * @param {string} [personalization]
 * @returns {Uint8Array} hash
 * @memberof crypto/keys
 * @private
 */
function prehashPass(value, personalization) {
    if (personalization) {
        personalization = { personalization: util.strToBytes(personalization) }; // eslint-disable-line
    }
    const prehashedPass = new BLAKE2s(32, personalization);
    prehashedPass.update(util.strToBytes(value));
    return prehashedPass.digest();
}

/**
 * Deterministically derives symmetrical boot key and auth key pair.
 * @param {string} username
 * @param {string} passphrase
 * @param {Uint8Array} randomSalt - 32 random bytes
 * @returns {Promise<{bootKey: Uint8Array, authKeyPair: KeyPair}>}
 * @memberof crypto/keys
 * @public
 */
function deriveAccountKeys(username, passphrase, randomSalt) {
    try {
        // requesting 64 bytes to split them for 2 keys
        const scryptOptions = { N: SCRYPT_N, r: 8, dkLen: 64, interruptStep: 2000 };
        // secure salt - contains username
        const salt = util.concatTypedArrays(util.strToBytes(username), randomSalt);
        const pass = prehashPass(passphrase, 'PeerioPH');

        return scryptPromise(pass, salt, scryptOptions)
            .then(derivedByteArray => {
                const keys = {};
                // first 32 bytes - symmetric boot key
                keys.bootKey = new Uint8Array(derivedByteArray.slice(0, 32));
                // second 32 bytes - secret key of the auth key pair
                const secretKey = new Uint8Array(derivedByteArray.slice(32, 64));
                keys.authKeyPair = nacl.box.keyPair.fromSecretKey(secretKey);
                return keys;
            });
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * Derive keys for a ghost/ephemeral user.
 * @param {Uint8Array} salt - e.g. ephemeral ID
 * @param {string} passphrase
 * @returns {Promise<KeyPair>}
 * @memberof crypto/keys
 * @public
 */
function deriveEphemeralKeys(salt, passphrase) {
    try {
        const scryptOptions = { N: SCRYPT_N, r: 8, dkLen: 32, interruptStep: 200, encoding: 'binary' };
        const pass = prehashPass(passphrase);
        return scryptPromise(pass, salt, scryptOptions)
            .then(keyBytes => nacl.box.keyPair.fromSecretKey(keyBytes));
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * @param {string} username
 * @param {string} passcode
 * @returns {Promise<Uint8Array>}
 * @memberof crypto/keys
 * @public
 */
function deriveKeyFromPasscode(username, passcode) {
    try {
        const scryptOptions = { N: SCRYPT_N, r: 8, dkLen: 32, interruptStep: 2000, encoding: 'binary' };
        const salt = util.strToBytes(username);
        const pass = prehashPass(passcode);

        return scryptPromise(pass, salt, scryptOptions);
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * Generates new random signing (ed25519) key pair.
 * @returns {KeyPair} - 32 byte public key and 64 byte secret key.
 * @memberof crypto/keys
 * @public
 */
function generateSigningKeyPair() {
    return nacl.sign.keyPair();
}

/**
 * Generates new random asymmetric (curve25519) key pair.
 * @returns {KeyPair} 32 byte keys
 * @memberof crypto/keys
 * @public
 */
function generateEncryptionKeyPair() {
    return nacl.box.keyPair();
}

/**
 * Generates new random symmetric (xsalsa20) 32 byte secret key.
 * @returns {Uint8Array} 32 bytes
 * @memberof crypto/keys
 * @public
 */
function generateEncryptionKey() {
    return util.getRandomBytes(32);
}

/**
 * Generates new salt for auth process
 * @returns {Uint8Array} 32 bytes
 * @memberof crypto/keys
 * @public
 */
function generateAuthSalt() {
    return util.getRandomBytes(32);
}

/**
 * Hashes auth public key. Uses personalized hash.
 * @returns {Uint8Array} 32 bytes personalized hash
 * @memberof crypto/keys
 * @public
 */
function getAuthKeyHash(key) {
    const hash = new BLAKE2s(32, { personalization: util.strToBytes('AuthCPK1') });
    hash.update(key);
    return hash.digest();
}

/**
 * Generates a random hex-encoded account key
 * formatted as "13c0 9f98 5be6 6013 044a 5471 5973 8e59"
 * containing 128 bits of entropy.
 *
 * @returns {string} account key
 */
function getRandomAccountKeyHex() {
    const a = [];
    for (let i = 0; i < 16; i += 2) {
        a.push(util.bytesToHex(util.getRandomBytes(2)));
    }
    return a.join(' ');
}


module.exports = {
    deriveAccountKeys,
    deriveEphemeralKeys,
    deriveKeyFromPasscode,
    generateSigningKeyPair,
    generateEncryptionKeyPair,
    generateEncryptionKey,
    generateAuthSalt,
    getAuthKeyHash,
    getRandomAccountKeyHex
};
