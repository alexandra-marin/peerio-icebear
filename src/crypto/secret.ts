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

import * as nacl from 'tweetnacl';
import * as util from './util';
import { DecryptionError } from '../errors';

interface NaclLowlevel {
    lowlevel: {
        // eslint-disable-next-line camelcase
        crypto_secretbox(
            cipherContainer: Uint8Array,
            message: Uint8Array,
            messageLength: number,
            nonce: Uint8Array,
            key: Uint8Array
        ): number;
        // eslint-disable-next-line camelcase
        crypto_secretbox_open(
            messageContainer: Uint8Array,
            cipher: Uint8Array,
            cipherLength: number,
            nonce: Uint8Array,
            key: Uint8Array
        ): number;
    };
}

/**
 * 24 - The size of the nonce is used for encryption
 */
export const NONCE_SIZE = 24;

/**
 * Encrypts and authenticates data using symmetric encryption.
 * This is a refactored version of nacl.secretbox().
 * @param key - 32 bytes symmetric key
 * @param nonce - in case you want to set your own nonce. 24 bytes.
 * @param appendNonce - appends nonce to the end of encrypted bytes
 * @param prependLength - adds 4 bytes containing message length after encryption to the beginning
 * @returns encrypted bytes
 */
export function encrypt(
    msgBytes: Uint8Array,
    key: Uint8Array,
    nonce = util.getRandomNonce(),
    appendNonce = true,
    prependLength = false
): Uint8Array {
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
    if (
        ((nacl as any) as NaclLowlevel).lowlevel.crypto_secretbox(
            cipherContainer,
            m,
            m.length,
            nonce,
            key
        ) !== 0
    ) {
        throw new Error('Encryption failed');
    }
    return c; // contains 16 zero bytes in the beginning, needed for decryption
}

/**
 * Helper method to decode string to bytes and encrypt it.
 * @param msg - message to encrypt
 * @param key - 32 bytes symmetric key
 * @returns encrypted bytes
 */
export function encryptString(msg: string, key: Uint8Array): Uint8Array {
    const msgBytes = util.strToBytes(msg);
    return encrypt(msgBytes, key);
}

/**
 * Decrypts and authenticates data using symmetric encryption.
 * This is a refactored version of nacl.secretbox.open().
 * @param cipher - cipher bytes with 16 zerobytes prepended and optionally appended nonce
 * @param key - 32 bytes symmetric key
 * @param nonce - pass nonce when it's not appended to cipher bytes
 * @param containsLength - whether or not to ignore first 4 bytes
 * @returns decrypted message
 */
export function decrypt(
    cipher: Uint8Array,
    key: Uint8Array,
    nonce?: Uint8Array,
    containsLength?: boolean
): Uint8Array {
    let start = 0;
    let end?: number;
    if (!nonce) {
        // eslint-disable-next-line no-param-reassign
        nonce = cipher.subarray(-NONCE_SIZE);
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
    if (
        ((nacl as any) as NaclLowlevel).lowlevel.crypto_secretbox_open(
            m,
            c,
            c.length,
            nonce,
            key
        ) !== 0
    ) {
        throw new DecryptionError('Decryption failed.');
    }
    return m.subarray(32); /* ZEROBYTES */
}

/**
 * Helper method to decode decrypted data to a string.
 * @param cipher - encrypted message
 * @param key - 32 bytes symmetric key
 * @returns decrypted message
 */
export function decryptString(cipher: Uint8Array, key: Uint8Array): string {
    return util.bytesToStr(decrypt(cipher, key));
}
