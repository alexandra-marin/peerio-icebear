/**
 * Mobile UI thread suffocates even with async scrypt so we let mobile implement scrypt in a worker thread.
 */

// default implementation is the normal one
const defaultScryptImplementation = require('scrypt-async');

let scryptImplementation: Scrypt = defaultScryptImplementation;

export interface ScryptConfig {
    /**
     * CPU/memory cost parameter (must be power of two; alternatively, you can
     * specify logN where N = 2^logN).
     */
    N?: number;
    logN?: number;

    /** block size parameter */
    r: number;
    /** parallelization parameter(default is 1) */
    p?: number;
    /** derived key length(default is 32) */
    dkLen?: number;

    /**
     * the amount of loop cycles to execute before the next
     * setImmediate/setTimeout (defaults to 0)
     */
    interruptStep?: number;

    /**
     * result encoding: 'base64' or 'hex' (result will be a string), 'binary'
     * (result will be a Uint8Array) or undefined (result will be an Array of
     * bytes).
     */
    // encoding?: 'base64' | 'hex' | 'binary';
}

interface ScryptTypeMap {
    base64: string;
    hex: string;
    binary: Uint8Array;
}

type ScryptParam = string | number[] | Uint8Array;

type Scrypt = <K extends keyof ScryptTypeMap>(
    value: ScryptParam,
    salt: ScryptParam,
    config: ScryptConfig & { encoding?: K },
    callback: (res: ScryptTypeMap[K]) => void
) => void;

/**
 * Returns chosen scrypt implementation.
 */
export function getScrypt(): Scrypt {
    return scryptImplementation;
}

/**
 * Sets chosen scrypt implementation.
 */
export function setScrypt(fn: Scrypt): void {
    scryptImplementation = fn;
}

/**
 * Promisified scrypt call.
 * @param value - the value that needs to be hashed
 * @param options - scrypt options, see {@link https://github.com/dchest/scrypt-async-js#options}
 * @returns hashed value
 */
export function scryptPromise<K extends keyof ScryptTypeMap>(
    value: ScryptParam,
    salt: ScryptParam,
    config: ScryptConfig & { encoding: K }
): Promise<ScryptTypeMap[K]>;
export function scryptPromise(
    value: ScryptParam,
    salt: ScryptParam,
    config: ScryptConfig
): Promise<number[]>;
export function scryptPromise(
    value: ScryptParam,
    salt: ScryptParam,
    config: ScryptConfig & { encoding?: 'base64' | 'hex' | 'binary' }
): Promise<ScryptParam> {
    return new Promise(resolve => {
        getScrypt()(value, salt, config, resolve);
    });
}
