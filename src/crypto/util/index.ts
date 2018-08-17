/*
 * Peerio crypto utilities module.
 * Exported from icebear index as `crypto.cryptoUtil`
 */
export * from './conversion';
export * from './random';
export * from './hashing';
export * from './padding';

/**
 * Concatenates two Uint8Arrays.
 */
export function concatTypedArrays(
    arr1: Uint8Array,
    arr2: Uint8Array
): Uint8Array {
    const joined = new Uint8Array(arr1.byteLength + arr2.byteLength);
    joined.set(new Uint8Array(arr1), 0);
    joined.set(new Uint8Array(arr2), arr1.byteLength);
    return joined;
}
