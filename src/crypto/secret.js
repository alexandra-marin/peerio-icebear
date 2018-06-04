/**
 * Secret key encryption module.
 *
 * Encrypt and decrypt functions replace `nacl.secretbox` and `nacl.secretbox.open`
 * see tweetnacl-js {@link https://github.com/dchest/tweetnacl-js}.
 * This replacement reduces the amount of memory allocation and copy operations.
 *
 * The output cipher bytes have following differences with `nacl.secretbox` output:
 * - nonce is appended to the cipher bytes.
 * - 16 BOXZEROBYTES in the beginning of cipher bytes are not stripped and another 16 are appended to them
 * because we'll need them for decryption
 *
 * Cipherbytes structure:
 * `[ 32 zero bytes ][ actual cipher bytes ][ 24-byte nonce]`
 *
 */

const nacl = require('tweetnacl');
const util = require('./util');
const { DecryptionError } = require('../errors');

/**
 * 24 - The size of the nonce is used for encryption
 */
const NONCE_SIZE = 24;

/**
 * Encrypts and authenticates data using symmetric encryption.
 * This is a refactored version of nacl.secretbox().
 * @param {Uint8Array} msgBytes
 * @param {Uint8Array} key - 32 bytes symmetric key
 * @param {Uint8Array} [nonce=getRandomNonce()] - in case you want to set your own nonce. 24 bytes.
 * @param {boolean} [appendNonce=true] - appends nonce to the end of encrypted bytes
 * @param {boolean} [prependLength=false] - adds 4 bytes containing message length after encryption to the beginning
 * @returns {Uint8Array} encrypted bytes
 */
function encrypt(msgBytes, key, nonce = util.getRandomNonce(), appendNonce = true, prependLength = false) {
    const fullMsgLength = 32 + msgBytes.length; /* ZEROBYTES */
    const m = new Uint8Array(fullMsgLength);
    for (let i = 32; i < fullMsgLength; i++) m[i] = msgBytes[i - 32];

    const lengthAdded = (appendNonce ? NONCE_SIZE : 0) + (prependLength ? 4 : 0);
    // container for cipher bytes
    const c = new Uint8Array(m.length + lengthAdded);
    if (appendNonce) {
        for (let i = 0; i < NONCE_SIZE; i++) c[c.length - NONCE_SIZE + i] = nonce[i];
    }
    if (prependLength) {
        const l = util.numberToByteArray(c.length - 4);
        for (let i = 0; i < 4; i++) c[i] = l[i];
    }
    // view of the same ArrayBuffer for encryption algorithm that does not know about our nonce concatenation
    let cipherContainer = c; // default value
    if (lengthAdded) {
        const start = prependLength ? 4 : 0;
        if (appendNonce) {
            cipherContainer = c.subarray(start, -NONCE_SIZE);
        } else {
            cipherContainer = c.subarray(start);
        }
    }
    if (nacl.lowlevel.crypto_secretbox(cipherContainer, m, m.length, nonce, key) !== 0) {
        throw new Error('Encryption failed');
    }
    return c; // contains 16 zero bytes in the beginning, needed for decryption
}

/**
 * Helper method to decode string to bytes and encrypt it.
 * @param {string} msg - message to encrypt
 * @param {Uint8Array} key - 32 bytes symmetric key
 * @returns {Uint8Array} encrypted bytes
 */
function encryptString(msg, key) {
    const msgBytes = util.strToBytes(msg);
    return encrypt(msgBytes, key);
}

/**
 * Decrypts and authenticates data using symmetric encryption.
 * This is a refactored version of nacl.secretbox.open().
 * @param {Uint8Array} cipher - cipher bytes with 16 zerobytes prepended and optionally appended nonce
 * @param {Uint8Array} key - 32 bytes symmetric key
 * @param {Uint8Array} [nonce='will be extracted from message'] - pass nonce when it's not appended to cipher bytes
 * @param {boolean} [containsLength=false] - whether or not to ignore first 4 bytes
 * @returns {Uint8Array} decrypted message
 */
function decrypt(cipher, key, nonce, containsLength) {
    let start = 0, end;
    if (!nonce) {
        nonce = cipher.subarray(-NONCE_SIZE); //eslint-disable-line
        end = -NONCE_SIZE;
    }
    if (containsLength) {
        start = 4;
    }

    let c = cipher;
    if (start || end) {
        c = c.subarray(start, end);
    }
    const m = new Uint8Array(c.length);
    if (nacl.lowlevel.crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) {
        throw new DecryptionError('Decryption failed.');
    }
    return m.subarray(32); /* ZEROBYTES */
}

/**
 * Helper method to decode decrypted data to a string.
 * @param {Uint8Array} cipher - encrypted message
 * @param {Uint8Array} key - 32 bytes symmetric key
 * @returns {string} decrypted message
 */
function decryptString(cipher, key) {
    return util.bytesToStr(decrypt(cipher, key));
}

module.exports = { encrypt, encryptString, decrypt, decryptString, NONCE_SIZE };
