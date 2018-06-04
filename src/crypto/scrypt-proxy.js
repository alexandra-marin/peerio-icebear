/**
 * Mobile UI thread suffocates even with async scrypt so we let mobile implement scrypt in a worker thread.
 */

// default implementation is the normal one
let scryptImplementation = require('scrypt-async');

/**
 * Returns chosen scrypt implementation.
 * @returns {function} scrypt
 */
function getScrypt() {
    return scryptImplementation;
}

/**
 * Sets chosen scrypt implementation.
 * @param {function} fn - scrypt
 */
function setScrypt(fn) {
    scryptImplementation = fn;
}

module.exports = { getScrypt, setScrypt };
