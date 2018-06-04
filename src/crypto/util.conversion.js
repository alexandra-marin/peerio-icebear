//
// Conversion part of Peerio crypto utilities module.
//
const { Buffer } = require('buffer/');

const HAS_TEXT_ENCODER = (typeof TextEncoder !== 'undefined') && (typeof TextDecoder !== 'undefined');
const textEncoder = HAS_TEXT_ENCODER ? new TextEncoder('utf-8') : null;
const textDecoder = HAS_TEXT_ENCODER ? new TextDecoder('utf-8') : null;

/**
 * Converts UTF8 string to byte array.
 * Uses native TextEncoder or Buffer.
 * @param {string} str - string to convert to byte array
 * @returns {Uint8Array} - utf8 decoded bytes
 */
function strToBytes(str) {
    if (HAS_TEXT_ENCODER) {
        return textEncoder.encode(str);
    }
    // returning Buffer instance will break deep equality tests since Buffer modifies prototype
    return new Uint8Array(Buffer.from(str, 'utf-8').buffer);
}

/**
 * Converts byte array to UTF8 string.
 * Uses native TextEncoder or Buffer.
 * @param {Uint8Array} bytes - utf8 bytes
 * @returns {string} encoded string
 */
function bytesToStr(bytes) {
    if (HAS_TEXT_ENCODER) {
        return textDecoder.decode(bytes);
    }
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf-8');
}

/**
 * Converts Base64 string to byte array.
 * @param {string} str - B64 string to decode
 * @returns {Uint8Array}
 */
function b64ToBytes(str) {
    return new Uint8Array(Buffer.from(str, 'base64').buffer);
}

/**
 * Converts Uint8Array or ArrayBuffer to Base64 string.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string} B64 string encoded bytes
 */
function bytesToB64(bytes) {
    return Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength).toString('base64');
}

/**
 * Converts Uint8Array or ArrayBuffer to hex encoded string.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string} B64 string encoded bytes (no 0x or other prefix, just data)
 */
function bytesToHex(bytes) {
    return Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength).toString('hex');
}

/**
 * Converts hex string to byte array.
 * @param {string} str - hex string to decode, no prefixes, just data
 * @returns {Uint8Array}
 */
function hexToBytes(str) {
    return new Uint8Array(Buffer.from(str, 'hex').buffer);
}


const converterDataView = new DataView(new ArrayBuffer(4));
/**
 * Converts 32-bit unsigned integer to byte array.
 * @param {number} num - 32-bit unsigned integer
 * @returns {Uint8Array}
 */
function numberToByteArray(num) {
    converterDataView.setUint32(0, num);
    return new Uint8Array(converterDataView.buffer.slice(0));
}

/**
 * Converts bytes to 32-bit unsigned integer.
 * @param {UInt8Array|ArrayBuffer} arr - 4 bytes representing unsigned integer
 * @returns {number} 32-bit unsigned integer
 */
function byteArrayToNumber(arr, offset, length) {
    // safari doesn't like undefined params
    return new DataView(arr.buffer || arr, offset || 0, length || arr.byteLength).getUint32(0);
}

module.exports = {
    bytesToB64,
    b64ToBytes,
    bytesToStr,
    bytesToHex,
    hexToBytes,
    strToBytes,
    numberToByteArray,
    byteArrayToNumber
};
