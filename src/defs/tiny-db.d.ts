/**
 * Interface for TinyDB storage engine implemented by every client and set in config for sdk to use.
 */
export interface TinyDBStorageEngineConstructor {
    /**
     * @param namespace - unique namespace will be passed to storage engine when instantiating.
     */
    new (namespace: string): TinyDBStorageEngine;
}
export interface TinyDBStorageEngine {
    /**
     * Asynchronously gets a value from storage.
     * If key doesn't exist - return null
     */
    getValue(key: string): Promise<string | null>;

    /**
     * Asynchronously saves a value to storage.
     * @param key - if key already exists - overwrite.
     */
    setValue(key: string, value: string): Promise<void>;

    /**
     * Asynchronously removes key/value from store.
     * @param key - if key doesn't exist, just resolve promise.
     */
    removeValue(key): Promise<void>;

    /**
     * Asynchronously retrieves a list of all keys in current namespace
     */
    getAllKeys(): Promise<string[]>;

    /**
     * Removes all data from current namespace.
     */
    clear(): Promise<void>;
}
