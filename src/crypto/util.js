/**
 * Peerio crypto utilities module.
 * Exported from icebear index as `crypto.cryptoUtil`
 */
const conversion = require('./util.conversion');
const random = require('./util.random');
const hashing = require('./util.hashing');
const padding = require('./util.padding');

/**
 * Concatenates two Uint8Arrays.
 * @param {Uint8Array} arr1
 * @param {Uint8Array} arr2
 * @returns {Uint8Array} new concatenated array.
 */
function concatTypedArrays(arr1, arr2) {
    const joined = new Uint8Array(arr1.byteLength + arr2.byteLength);
    joined.set(new Uint8Array(arr1), 0);
    joined.set(new Uint8Array(arr2), arr1.byteLength);
    return joined;
}

module.exports = Object.assign(
    { concatTypedArrays },
    conversion,
    random,
    hashing,
    padding
);
