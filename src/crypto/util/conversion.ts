//
// Conversion part of Peerio crypto utilities module.
//

// The trailing slash in this import is necessary -- this isn't the native Node
// buffer, but a "polyfill" (that actually behaves differently than the thing
// it's polyfilling, because javascript software engineering.) Mysterious things
// will explode and you'll lose hours to debugging weird errors (questioning
// whether you've completely gone unhinged) if you omit the slash. Don't omit
// the slash.
import { Buffer as BufferPolyfill } from 'buffer/';

const Buffer = global.Buffer || BufferPolyfill;

// TextEncoder only supports UTF-8, so the constructor has no params
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

/**
 * Converts UTF8 string to byte array.
 * Uses native TextEncoder or Buffer.
 * @param str string to convert to byte array
 * @returns utf8 decoded bytes
 */
export function strToBytes(str: string): Uint8Array {
    if (textEncoder) {
        return textEncoder.encode(str);
    }
    // returning Buffer instance will break deep equality tests since Buffer modifies prototype
    const bytes = Buffer.from(str, 'utf-8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Converts byte array to UTF8 string.
 * Uses native TextEncoder or Buffer.
 * @param bytes utf8 bytes
 * @returns encoded string
 */
export function bytesToStr(bytes: Uint8Array): string {
    if (textDecoder) {
        return textDecoder.decode(bytes);
    }
    return Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength).toString(
        'utf-8'
    );
}

/**
 * Converts Base64 string to byte array.
 * @param str B64 string to decode
 */
export function b64ToBytes(str: string): Uint8Array {
    const bytes = Buffer.from(str, 'base64');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Converts Uint8Array or ArrayBuffer to Base64 string.
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
        return Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)
            .toString('hex')
            .toLowerCase();
    }
    return Buffer.from(bytes, 0, bytes.byteLength)
        .toString('hex')
        .toLowerCase();
}

/**
 * Converts hex string to byte array.
 * @param str hex string to decode, no prefixes, just data
 */
export function hexToBytes(str: string): Uint8Array {
    const bytes = Buffer.from(str, 'hex');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
