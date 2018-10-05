/**
 * Digital signing module
 */

import * as nacl from 'tweetnacl';

type SignFunc = (msg: Uint8Array, secretKey: Uint8Array) => Uint8Array;
type VerifyFunc = (msg: Uint8Array, sig: Uint8Array, publicKey: Uint8Array) => boolean;

let sign: SignFunc = nacl.sign.detached;
let verify: VerifyFunc = nacl.sign.detached.verify;

/**
 * Signs the message with secret key and returns detached signature
 * @param message - any data that needs signing
 * @param secretKey - 64 bytes secret key from the signing user's signing key pair.
 * @returns 64 bytes signature
 */
export function signDetached(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
    // this makes it work for both sync and async implementations of sign
    return Promise.resolve(sign(message, secretKey));
}

/**
 * Verifies message signature
 * @param message - any data that needs verifying
 * @param signature - 64 bytes
 * @param publicKey - 32 bytes public key from the signing user's signing key pair.
 * @returns verification result
 */
export function verifyDetached(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
): Promise<boolean> {
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
 * @param signFunc - see {@link signDetached}
 * @param verifyFunc - see {@link verifyDetached}
 */

export function setImplementation(signFunc: SignFunc, verifyFunc: VerifyFunc) {
    sign = signFunc;
    verify = verifyFunc;
}
