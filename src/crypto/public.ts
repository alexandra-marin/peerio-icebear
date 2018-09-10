/*
 * Public key encryption module
 */

import * as nacl from 'tweetnacl';
import * as secret from './secret';
import { DecryptionError } from '../errors';

/**
 * This is a classic variant of decryption function for server compatibility.
 * It's used for decrypting authTokens and other tokens. For everything else
 * client uses optimized version {@link decrypt}
 *
 * @param cipher - encrypted bytes
 * @param nonce - 24 byte nonce
 * @param theirPublicKey - message sender's public key
 * @param mySecretKey - decrypting user's secret key
 * @returns decrypted bytes
 */
export function decryptCompat(
    cipher: Uint8Array,
    nonce: Uint8Array,
    theirPublicKey: Uint8Array,
    mySecretKey: Uint8Array
): Uint8Array {
    const decrypted = nacl.box.open(cipher, nonce, theirPublicKey, mySecretKey);
    if (decrypted === null) throw new DecryptionError();
    // underlying buffer is > then ciphertext, this can lead to numerous bugs, so we slice it
    return decrypted.slice();
}

/**
 * Encrypt using public key crypto.
 *
 * WARNING: this function is ok to use for occasional operations, but for
 * performance-critical parts it's better to use crypto/secret.encrypt
 * {@link crypto/secret:encrypt} with precalculated shared key from User class
 * {@link User}
 *
 * @param msgBytes - unencrypted message
 * @param theirPublicKey - message recipient's public key
 * @param mySecretKey - encrypting user's secret key
 * @returns encrypted bytes
 */
export function encrypt(
    msgBytes: Uint8Array,
    theirPublicKey: Uint8Array,
    mySecretKey: Uint8Array
): Uint8Array {
    const sharedKey = nacl.box.before(theirPublicKey, mySecretKey);
    return secret.encrypt(msgBytes, sharedKey);
}

/**
 * Decrypt using public key crypto.
 *
 * WARNING: this function is ok to use for occasional operations, but for
 * performance-critical parts it's better to use crypto/secret.encrypt
 * {@link crypto/secret:encrypt} with precalculated shared key from User class
 * {@link User}
 *
 * @param cipher - encrypted bytes
 * @param theirPublicKey - message sender's public key
 * @param mySecretKey - decrypting user's secret key
 * @returns decrypted bytes
 */
export function decrypt(
    cipher: Uint8Array,
    theirPublicKey: Uint8Array,
    mySecretKey: Uint8Array
): Uint8Array {
    const sharedKey = nacl.box.before(theirPublicKey, mySecretKey);
    return secret.decrypt(cipher, sharedKey);
}

/**
 * Calculates shared key for public key crypto.
 * @param theirPublicKey - other user's public key
 * @param mySecretKey - current user's secret key
 * @returns 32 bytes shared key
 */
export const computeSharedKey: (theirPublicKey: Uint8Array, mySecretKey: Uint8Array) => Uint8Array =
    nacl.box.before;
