/**
 * Peerio Crypto module for key handling.
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
        console.log(
            'TEST ENVIRONMENT DETECTED. SCRYPT WILL USE REDUCED COMPLEXITY FOR PERFORMANCE BOOST.'
        );
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
 */
function prehashPass(value, personalization) {
    if (personalization) {
        // eslint-disable-next-line no-param-reassign
        personalization = { personalization: util.strToBytes(personalization) };
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
 */
function deriveAccountKeys(username, passphrase, randomSalt) {
    try {
        // requesting 64 bytes to split them for 2 keys
        const scryptOptions = {
            N: SCRYPT_N,
            r: 8,
            dkLen: 64,
            interruptStep: 2000
        };
        // secure salt - contains username
        const salt = util.concatTypedArrays(
            util.strToBytes(username),
            randomSalt
        );
        const pass = prehashPass(passphrase, 'PeerioPH');

        return scryptPromise(pass, salt, scryptOptions).then(
            derivedByteArray => {
                const keys = {};
                // first 32 bytes - symmetric boot key
                keys.bootKey = new Uint8Array(derivedByteArray.slice(0, 32));
                // second 32 bytes - secret key of the auth key pair
                const secretKey = new Uint8Array(
                    derivedByteArray.slice(32, 64)
                );
                keys.authKeyPair = nacl.box.keyPair.fromSecretKey(secretKey);
                return keys;
            }
        );
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * Derive keys for a ghost/ephemeral user.
 * @param {Uint8Array} salt - e.g. ephemeral ID
 * @param {string} passphrase
 * @returns {Promise<KeyPair>}
 */
function deriveEphemeralKeys(salt, passphrase) {
    try {
        const scryptOptions = {
            N: SCRYPT_N,
            r: 8,
            dkLen: 32,
            interruptStep: 200,
            encoding: 'binary'
        };
        const pass = prehashPass(passphrase);
        return scryptPromise(pass, salt, scryptOptions).then(keyBytes =>
            nacl.box.keyPair.fromSecretKey(keyBytes)
        );
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * @param {string} username
 * @param {string} passcode
 * @returns {Promise<Uint8Array>}
 */
function deriveKeyFromPasscode(username, passcode) {
    try {
        const scryptOptions = {
            N: SCRYPT_N,
            r: 8,
            dkLen: 32,
            interruptStep: 2000,
            encoding: 'binary'
        };
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
 */
function generateSigningKeyPair() {
    return nacl.sign.keyPair();
}

/**
 * Generates new random asymmetric (curve25519) key pair.
 * @returns {KeyPair} 32 byte keys
 */
function generateEncryptionKeyPair() {
    return nacl.box.keyPair();
}

/**
 * Generates new random symmetric (xsalsa20) 32 byte secret key.
 * @returns {Uint8Array} 32 bytes
 */
function generateEncryptionKey() {
    return util.getRandomBytes(32);
}

/**
 * Generates new salt for auth process
 * @returns {Uint8Array} 32 bytes
 */
function generateAuthSalt() {
    return util.getRandomBytes(32);
}

/**
 * Hashes auth public key. Uses personalized hash.
 * @returns {Uint8Array} 32 bytes personalized hash
 */
function getAuthKeyHash(key) {
    const hash = new BLAKE2s(32, {
        personalization: util.strToBytes('AuthCPK1')
    });
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
