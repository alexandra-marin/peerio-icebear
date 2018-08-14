//
// Padding part of Peerio crypto utilities module.
//

export const MAX_PASSPHRASE_LENGTH = 1024;

/**
 * Adds 0 bytes to the end of a Uint8Array until it is `length` bytes long.
 */
export function padBytes(arr: Uint8Array, length: number): Uint8Array {
    const newBytes = new Uint8Array(length).fill(0);
    newBytes.set(arr);
    return newBytes;
}

/**
 * Pads passphrase (aka Account Key) to MAX_PASSPHRASE_LENGTH + 8
 * characters.
 * @returns passhprase padded with dots `.`
 * @throws if passphrase is too long
 */
export function padPassphrase(passphrase: string): string {
    if (passphrase.length > MAX_PASSPHRASE_LENGTH) {
        throw new Error('Account Key is too long');
    }
    // Calculate hex length
    const len = `00000000${passphrase.length.toString(16)}`.substr(-8);
    // Calculate padding.
    const paddingLen = MAX_PASSPHRASE_LENGTH - passphrase.length;
    const padding = new Array(paddingLen + 1).join('.'); // string of paddingLen dots
    // Return len || passphrase || padding
    return len + passphrase + padding;
}

/**
 * Unpads passphrase (aka Account Key) padded by {@link padPassphrase}.
 * @returns unpadded passphrase
 * @throws if padded passphrase is too short
 */
export function unpadPassphrase(paddedPassphrase: string): string {
    if (paddedPassphrase.length < 8) {
        // Must have at least hex length.
        throw new Error('Malformed padded passphrase');
    }
    // Extract hex length of unpadded passphrase.
    const len = parseInt(paddedPassphrase.substring(0, 8), 16);
    // Check that padding is correct.
    const paddingLen = MAX_PASSPHRASE_LENGTH - len;
    if (8 + len + paddingLen !== paddedPassphrase.length) {
        throw new Error('Malformed padded passphrase');
    }
    return paddedPassphrase.substring(8, 8 + len);
}
