//
// Hashing part of Peerio crypto utilities module.
//

import BLAKE2s from 'blake2s-js';
import { scryptPromise } from '../scrypt-proxy';
import { strToBytes } from './conversion';
import * as padding from './padding';

/**
 * Hashes a value and returns BLAKE2s object.
 * @param length - hash length 1-32
 * @param value - value to hash
 */
export function getHashObject(
    length: number,
    value: Uint8Array,
    personalizationString?: string
): BLAKE2s {
    const h = personalizationString
        ? new BLAKE2s(length, {
              personalization: padding.padBytes(strToBytes(personalizationString), 8)
          })
        : new BLAKE2s(length);
    h.update(value);
    return h;
}

/**
 * Hashes a value and returns hex string.
 * @param length - hash length 1-32
 * @param value - value to hash
 * @returns hex encoded hash
 */
export function getHexHash(
    length: number,
    value: Uint8Array,
    personalizationString?: string
): string {
    return getHashObject(length, value, personalizationString).hexDigest();
}

/**
 * Hashes a value and returns hash bytes.
 * @param length - hash length 1-32
 * @param value - value to hash
 * @returns hash bytes
 */
export function getByteHash(
    length: number,
    value: Uint8Array,
    personalizationString?: string
): Uint8Array {
    return getHashObject(length, value, personalizationString).digest();
}

/**
 * Returns user fingerprint string.
 * @returns fingerprint. Example: `51823-23479-94038-76454-79776-13778`
 */
export function getFingerprint(username: string, publicKey: Uint8Array): Promise<string> {
    return scryptPromise(publicKey, strToBytes(username), {
        N: 4096,
        r: 8,
        dkLen: 24,
        encoding: 'binary'
    }).then(fingerprintToStr);
}

/**
 * Converts fingerprint bytes to string representation.
 * @returns fingerprint. Example: `51823-23479-94038-76454-79776-13778`
 */
function fingerprintToStr(bytes: Uint8Array): string {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const c = [];
    for (let i = 0; i < bytes.length; i += 4) {
        c.push(`00000${v.getUint32(i) % 100000}`.slice(-5));
    }
    return c.join('-');
}
