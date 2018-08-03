//
// Conversion part of Peerio crypto utilities module.
//
import { Buffer } from 'buffer';

const HAS_TEXT_ENCODER =
    typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined';

// TextEncoder only supports UTF-8, so the constructor has no params
const textEncoder = HAS_TEXT_ENCODER ? new TextEncoder() : null;
const textDecoder = HAS_TEXT_ENCODER ? new TextDecoder('utf-8') : null;

/**
 * Converts UTF8 string to byte array.
 * Uses native TextEncoder or Buffer.
 * @param str string to convert to byte array
 * @returns utf8 decoded bytes
 */
export function strToBytes(str: string): Uint8Array {
    if (HAS_TEXT_ENCODER) {
        return textEncoder.encode(str);
    }
    // returning Buffer instance will break deep equality tests since Buffer modifies prototype
    return new Uint8Array(Buffer.from(str, 'utf-8').buffer);
}

/**
 * Converts byte array to UTF8 string.
 * Uses native TextEncoder or Buffer.
 * @param bytes utf8 bytes
 * @returns encoded string
 */
export function bytesToStr(bytes: Uint8Array): string {
    if (HAS_TEXT_ENCODER) {
        return textDecoder.decode(bytes);
    }
    return Buffer.from(
        bytes.buffer as ArrayBuffer,
        bytes.byteOffset,
        bytes.byteLength
    ).toString('utf-8');
}

/**
 * Converts Base64 string to byte array.
 * @param str B64 string to decode
 */
export function b64ToBytes(str: string): Uint8Array {
    return new Uint8Array(Buffer.from(str, 'base64').buffer);
}

/**
 * Converts Uint8Array or ArrayBuffer to Base64 string.
 * @param bytes
 * @returns B64 string encoded bytes
 */
export function bytesToB64(bytes: Uint8Array | ArrayBuffer): string {
    if (bytes instanceof Uint8Array) {
        return Buffer.from(
            bytes.buffer as ArrayBuffer,
            bytes.byteOffset,
            bytes.byteLength
        ).toString('base64');
    }
    return Buffer.from(bytes, 0, bytes.byteLength).toString('base64');
}

/**
 * Converts Uint8Array or ArrayBuffer to hex encoded string.
 * @returns B64 string encoded bytes (no 0x or other prefix, just data)
 */
export function bytesToHex(bytes: Uint8Array | ArrayBuffer): string {
    if (bytes instanceof Uint8Array) {
        return Buffer.from(
            bytes.buffer as ArrayBuffer,
            bytes.byteOffset,
            bytes.byteLength
        ).toString('hex');
    }
    return Buffer.from(bytes, 0, bytes.byteLength).toString('hex');
}

/**
 * Converts hex string to byte array.
 * @param str hex string to decode, no prefixes, just data
 */
export function hexToBytes(str: string): Uint8Array {
    return new Uint8Array(Buffer.from(str, 'hex').buffer);
}

const converterDataView = new DataView(new ArrayBuffer(4));
/**
 * Converts 32-bit unsigned integer to byte array.
 * @param num 32-bit unsigned integer
 */
export function numberToByteArray(num: number): Uint8Array {
    converterDataView.setUint32(0, num);
    return new Uint8Array(converterDataView.buffer.slice(0));
}

/**
 * Converts bytes to 32-bit unsigned integer.
 * @param arr - 4 bytes representing unsigned integer
 * @returns 32-bit unsigned integer
 */
export function byteArrayToNumber(
    arr: Uint8Array | ArrayBuffer,
    offset = 0,
    length = arr.byteLength
): number {
    if (arr instanceof Uint8Array) {
        return new DataView(arr.buffer, offset, length).getUint32(0);
    }
    // safari doesn't like undefined params
    return new DataView(arr, offset, length).getUint32(0);
}
