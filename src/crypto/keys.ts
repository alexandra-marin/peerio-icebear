/**
 * Peerio Crypto module for key handling.
 */
import BLAKE2s from 'blake2s-js';
import * as nacl from 'tweetnacl';
import { scryptPromise } from './scrypt-proxy';
import { bytesToHex, strToBytes, concatTypedArrays, getRandomBytes } from './util';
import * as errors from '../errors';
import { KeyPair } from '../defs/interfaces';

// ------------------------------------------------------------------------------------------
// WARNING: changing scrypt params will break compatibility with older scrypt-generated data
// ------------------------------------------------------------------------------------------
let SCRYPT_N = 16384;
try {
    if (process.env.PEERIO_REDUCE_SCRYPT_FOR_TESTS) {
        console.log(
            'TEST ENVIRONMENT DETECTED. SCRYPT WILL USE REDUCED COMPLEXITY FOR PERFORMANCE BOOST.'
        );
        SCRYPT_N = 1024;
    }
} catch (ex) {
    //  meh
}

/**
 * Prehashes secret for stronger key derivation.
 * @param value - passphrase or other secret
 * @returns the hash
 */
function prehashPass(value: string, personalization?: string): Uint8Array {
    const prehashedPass = personalization
        ? new BLAKE2s(32, { personalization: strToBytes(personalization) })
        : new BLAKE2s(32);
    prehashedPass.update(strToBytes(value));
    return prehashedPass.digest();
}

/**
 * Deterministically derives symmetrical boot key and auth key pair.
 * @param randomSalt - 32 random bytes
 */
export function deriveAccountKeys(
    username: string,
    passphrase: string,
    randomSalt: Uint8Array
): Promise<{ bootKey: Uint8Array; authKeyPair: KeyPair }> {
    try {
        // requesting 64 bytes to split them for 2 keys
        const scryptOptions = {
            N: SCRYPT_N,
            r: 8,
            dkLen: 64,
            interruptStep: 2000
        };
        // secure salt - contains username
        const salt = concatTypedArrays(strToBytes(username), randomSalt);
        const pass = prehashPass(passphrase, 'PeerioPH');

        return scryptPromise(pass, salt, scryptOptions).then(derivedByteArray => {
            const secretKey = new Uint8Array(derivedByteArray.slice(32, 64));
            return {
                // first 32 bytes - symmetric boot key
                bootKey: new Uint8Array(derivedByteArray.slice(0, 32)),
                // second 32 bytes - secret key of the auth key pair
                authKeyPair: nacl.box.keyPair.fromSecretKey(secretKey)
            };
        });
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * Derive keys for an ephemeral user.
 * @param salt e.g. ephemeral ID
 */
export function deriveEphemeralKeys(salt: Uint8Array, passphrase: string): Promise<KeyPair> {
    try {
        const pass = prehashPass(passphrase);
        return scryptPromise(pass, salt, {
            N: SCRYPT_N,
            r: 8,
            dkLen: 32,
            interruptStep: 200,
            encoding: 'binary'
        }).then(keyBytes => nacl.box.keyPair.fromSecretKey(keyBytes));
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

export function deriveKeyFromPasscode(username: string, passcode: string): Promise<Uint8Array> {
    try {
        const salt = strToBytes(username);
        const pass = prehashPass(passcode);

        return scryptPromise(pass, salt, {
            N: SCRYPT_N,
            r: 8,
            dkLen: 32,
            interruptStep: 2000,
            encoding: 'binary'
        });
    } catch (ex) {
        return Promise.reject(errors.normalize(ex));
    }
}

/**
 * Generates new random signing (ed25519) key pair.
 * @returns 32 byte public key and 64 byte secret key.
 */
export function generateSigningKeyPair(): KeyPair {
    return nacl.sign.keyPair();
}

/**
 * Generates new random asymmetric (curve25519) key pair.
 * @returns 32 byte keys
 */
export function generateEncryptionKeyPair(): KeyPair {
    return nacl.box.keyPair();
}

/**
 * Generates new random symmetric (xsalsa20) 32 byte secret key.
 * @returns 32 bytes
 */
export function generateEncryptionKey(): Uint8Array {
    return getRandomBytes(32);
}

/**
 * Generates new salt for auth process
 * @returns 32 bytes
 */
export function generateAuthSalt(): Uint8Array {
    return getRandomBytes(32);
}

/**
 * Hashes auth public key. Uses personalized hash.
 * @returns 32 bytes personalized hash
 */
export function getAuthKeyHash(key: Uint8Array): Uint8Array {
    const hash = new BLAKE2s(32, { personalization: strToBytes('AuthCPK1') });
    hash.update(key);
    return hash.digest();
}

/**
 * Generates a random hex-encoded account key
 * formatted as "13c0 9f98 5be6 6013 044a 5471 5973 8e59"
 * containing 128 bits of entropy.
 *
 * @returns account key
 */
export function getRandomAccountKeyHex(): string {
    const a = [];
    for (let i = 0; i < 16; i += 2) {
        a.push(bytesToHex(getRandomBytes(2)));
    }
    return a.join(' ');
}
