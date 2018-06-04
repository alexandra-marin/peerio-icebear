/**
 * Digital signing module
 */

const nacl = require('tweetnacl');

let sign = nacl.sign.detached;
let { verify } = nacl.sign.detached;

/**
 * Signs the message with secret key and returns detached signature
 * @param {Uint8Array} message - any data that needs signing
 * @param {Uint8Array} secretKey - 64 bytes secret key from the signing user's signing key pair.
 * @returns {Promise<Uint8Array>} 64 bytes signature
 */
function signDetached(message, secretKey) {
    // this makes it work for both sync and async implementations of sign
    return Promise.resolve(sign(message, secretKey));
}

/**
 * Verifies message signature
 * @param {Uint8Array} message - any data that needs verifying
 * @param {Uint8Array} signature - 64 bytes
 * @param {Uint8Array} publicKey - 32 bytes public key from the signing user's signing key pair.
 * @returns {Promise<boolean>} verification result
 */
function verifyDetached(message, signature, publicKey) {
    let result = false;
    try {
        result = verify(message, signature, publicKey);
    } catch (err) {
        console.error(err);
    }
    // this makes it work for both sync and async implementations of verify
    return Promise.resolve(result);
}

/**
 * Allows overriding of sign and verify functions in case it has to be an async implementation.
 * Mobile currently uses this.
 * @param {function} signFunc - see {@link signDetached}
 * @param {function} verifyFunc - see {@link verifyDetached}
 */
function setImplementation(signFunc, verifyFunc) {
    sign = signFunc;
    verify = verifyFunc;
}

module.exports = { signDetached, verifyDetached, setImplementation };
