/**
 * This is a contract for the actual client-specific StorageEngine client has to implement and set to config module.
 * TinyDb will get the implementation from config module and use it.
 * Values in current instance should be stored under that unique namespace.
 */
export default interface StorageEngineInterface {
    readonly namespace: string;

    /**
     * Asynchronously gets a value from storage.
     * @returns strictly `null` if key or value doesn't exist. TinyDb stores only strings,
     *          so any other return type is an error.
     */
    getValue(key: string): Promise<string>;

    /**
     * Asynchronously saves a value to storage.
     * @param key - if key already exists - overwrite.
     * @param value - TinyDb will serialize any value to string before saving it.
     */
    setValue(key: string, value: string): Promise<void>;

    /**
     * Asynchronously removes key/value from store.
     * @param key - if key doesn't exist, just resolve promise.
     */
    removeValue(key: string): Promise<void>;

    /**
     * Asynchronously retrieves a list of all keys in current namespace
     */
    getAllKeys(): Promise<string[]>;

    /**
     * Removes all data from current namespace.
     */
    clear(): Promise<void>;
}
