/*
 * Various utility functions that didn't fit anywhere else.
 */

/**
 * Finds all ArrayBuffer type properties recursively and changes them to Uint8Array created with the same ArrayBuffer.
 * @param obj - object to check for ArrayBuffers.
 * @returns  same object that was passed but with some property values changed.
 */
export function convertBuffers(obj: any): any {
    if (typeof obj !== 'object') return obj;

    for (const prop in obj) {
        const type = typeof obj[prop];
        if (type !== 'object') {
            continue;
        }
        if (obj[prop] instanceof ArrayBuffer) {
            obj[prop] = new Uint8Array(obj[prop]);
        } else {
            convertBuffers(obj[prop]);
        }
    }
    return obj;
}

/**
 * Converts bytes number to human-readable string format.
 */
export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    else if (bytes < 1048576) return `${+(bytes / 1024).toFixed(2)} KB`;
    else if (bytes < 1073741824) return `${+(bytes / 1048576).toFixed(2)} MB`;
    return `${+(bytes / 1073741824).toFixed(2)} GB`;
}

/**
 * Tries to get a value. If it fails, returns default value or undefined.
 * Do not use this in performance critical cases because of deliberate exception throwing
 * @param fn - Functor, which may throw exception in which case default value will be used.
 * @returns Result of fn execution, if it didn't throw exception, or defaultValue
 * NOTE: explicit any is intentional, this function is supposed to try and return anything from anything
 */
export function tryToGet(fn: any, defaultValue: any) {
    try {
        return fn();
    } catch (e) {
        // console.error(e);
    }
    return defaultValue;
}

export function simpleHash(str: string): number {
    let hash = 0;
    if (!str.length) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash &= hash; // Convert to 32bit integer
    }
    return hash;
}
