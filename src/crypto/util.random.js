//
// Random things generator part of Peerio crypto utilities module.
//

const { InvalidArgumentError } = require('../errors');
const convert = require('./util.conversion');
const hashing = require('./util.hashing');

/**
 * Generates random bytes suitable for crypto use
 * @param {number} num - byte count to return
 * @returns {Uint8Array} - random bytes array of `num` size
 * @function getRandomBytes
 * @memberof crypto/util
 * @public
 */
let getRandomBytes;

// do we have crypto shim?
if (global && global.cryptoShim) {
    getRandomBytes = function(num) {
        return global.cryptoShim.randomBytes(num);
    };
}

// node crypto?
if (!getRandomBytes && global) {
    try {
        const crypto = require('crypto'); //eslint-disable-line
        getRandomBytes = function(num) {
            return crypto.randomBytes(num);
        };
    } catch (err) {
        // we don't care, this is a way to detect if module exists
    }
}

// browser crypto?
if (!getRandomBytes && window) {
    getRandomBytes = function(num) {
        return window.crypto.getRandomValues(new Uint8Array(num));
    };
}

if (!getRandomBytes) throw new Error('No PRNG implementation found. Application can not start.');

/**
 * Generated cryptographically secure random number in a set range.
 * Range can't be more then 2**31 (2147483648).
 * @param {number} [min=0] - minimum random number value (inclusive)
 * @param {number} [max=2147483648] - maximum random value (exclusive)
 * @returns {number} random number
 * @throws {InvalidArgumentError}
 * @memberof crypto/util
 * @public
 */
function getRandomNumber(min = 0, max = 2147483648) {
    const range = max - min;
    if (typeof min !== 'number' || typeof max !== 'number' || range <= 0) {
        throw new InvalidArgumentError();
    }
    const bitsNeeded = Math.ceil(Math.log2(range));
    if (bitsNeeded > 31) {
        throw new InvalidArgumentError('Range too big for getRandomNumber()');
    }
    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    const mask = (2 ** bitsNeeded) - 1;

    let rval = 0;

    do {
        const byteArray = getRandomBytes(bytesNeeded);
        rval = 0;

        let p = (bytesNeeded - 1) * 8;
        for (let i = 0; i < bytesNeeded; i++) {
            rval += byteArray[i] * (2 ** p);
            p -= 8;
        }
        rval &= mask;
    } while (rval >= range);

    return min + rval;
}

/**
 * Generates 24-byte unique random nonce.
 * Partially consists of 4 bytes of current timestamp. 4 bytes fits almost 50 days worth of milliseconds,
 * so if you are generating 1 nonce every millisecond, it's guaranteed to have no collisions within 50 days
 * even without random bytes part.
 * @returns {Uint8Array} - 24 bytes, [4: from timestamp][20: random]
 * @memberof crypto/util
 * @public
 */
function getRandomNonce() {
    const nonce = new Uint8Array(24);
    // we take last 4 bytes of current date timestamp
    nonce.set(convert.numberToByteArray(Date.now() >>> 32));
    // and 20 random bytes
    nonce.set(getRandomBytes(20), 4);
    return nonce;
}

/**
 * Generates random id bytes.
 * Partially consists of hashed username and timestamp.
 * @param {string} username
 * @returns {Uint8Array} 42 bytes, [16: username+timestamp hash][26: random bytes]
 * @memberof crypto/util
 * @public
 */
function getRandomUserSpecificIdBytes(username) {
    const id = new Uint8Array(42);
    const hash = hashing.getByteHash(16, convert.strToBytes(username + Date.now().toString()));
    id.set(hash);
    id.set(getRandomBytes(26), 16);
    return id;
}

/**
 * Same as {@link crypto/util:getRandomUserSpecificIdBytes} but returns B64 string
 * @param {string} username
 * @returns {string} id in base64 encoding
 * @memberof crypto/util
 * @public
 */
function getRandomUserSpecificIdB64(username) {
    return convert.bytesToB64(getRandomUserSpecificIdBytes(username));
}

/**
 * @see crypto/util:getRandomUserSpecificIdBytes
 * @param {string} username
 * @returns {string} id in hex encoding
 * @memberof crypto/util
 * @public
 */
function getRandomUserSpecificIdHex(username) {
    return convert.bytesToHex(getRandomUserSpecificIdBytes(username));
}

/**
 * Generates hex string of 10-byte unique random id suitable for personal use (one keg db).
 * @returns {string} 10 bytes id in hex encoding
 * @memberof crypto/util
 * @public
 */
function getRandomShortIdHex() {
    const id = new Uint8Array(10);
    // we take last 4 bytes of current date timestamp
    id.set(convert.numberToByteArray(Date.now() >>> 32));
    // and 6 random bytes
    id.set(getRandomBytes(6), 4);
    return convert.bytesToHex(id);
}

module.exports = {
    getRandomBytes,
    getRandomNumber,
    getRandomNonce,
    getRandomUserSpecificIdBytes,
    getRandomUserSpecificIdB64,
    getRandomUserSpecificIdHex,
    getRandomShortIdHex
};
