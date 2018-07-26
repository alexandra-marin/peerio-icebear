//
// Padding part of Peerio crypto utilities module.
//

/**
 * @const
 * @returns {number} 1024
 */
const MAX_PASSPHRASE_LENGTH = 1024;

/**
 * Adds 0 bytes to the end of a Uint8Array until it is `length` bytes long.
 * @param {Uint8Array} arr
 * @param {number} length
 * @returns {Uint8Array} new zero-padded array
 */
function padBytes(arr, length) {
    const newBytes = new Uint8Array(length).fill(0);
    newBytes.set(arr);
    return newBytes;
}

/**
 * Pads passphrase (aka Account Key) to MAX_PASSPHRASE_LENGTH + 8
 * characters.
 * @param {string} passphrase
 * @returns {string} passhprase padded with dots `.`
 * @throws if passphrase is too long
 */
function padPassphrase(passphrase) {
    if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
        throw new Error('Account Key is too long');
    }
    // Calculate hex length
    const len = (`00000000${(passphrase.length).toString(16)}`).substr(-8);
    // Calculate padding.
    const paddingLen = MAX_PASSPHRASE_LENGTH - passphrase.length;
    const padding = new Array(paddingLen + 1).join('.'); // string of paddingLen dots
    // Return len || passphrase || padding
    return len + passphrase + padding;
}

/**
 * Unpads passphrase (aka Account Key) padded by {@link padPassphrase}.
 * @param {string} paddedPassphrase
 * @returns {string} unpadded passphrase
 * @throws if padded passphrase is too short
 */
function unpadPassphrase(paddedPassphrase) {
    if (paddedPassphrase.length < 8) {
        // Must have at least hex length.
        throw new Error('Malformed padded passphrase');
    }
    // Extract hex length of unpadded passphrase.
    const len = parseInt(paddedPassphrase.substring(0, 8), 16);
    // Check that padding is correct.
    const paddingLen = MAX_PASSPHRASE_LENGTH - len;
    if (8 + len + paddingLen !== paddedPassphrase.length) {
        throw new Error('Malformed padded passphrase');
    }
    return paddedPassphrase.substring(8, 8 + len);
}

module.exports = {
    padBytes,
    padPassphrase,
    unpadPassphrase,
    MAX_PASSPHRASE_LENGTH
};
