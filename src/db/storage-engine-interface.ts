/**
 * This is a contract for the actual client-specific StorageEngine client has to implement and set to config module.
 * TinyDb will get the implementation from config module and use it.
 */
export interface StorageEngineInterface {
    /**
     * @param namespace - unique namespace will be passed to storage engine when instantiating.
     */
    new (namespace: string, keyPath?: string): StorageEngineInterface;

    /**
     * Asynchronously gets a value from storage.
     */
    getValue(key: string): Promise<string>;

    /**
     * Asynchronously saves a value to storage.
     * @param key - if key already exists - overwrite.
     */
    setValue(key: string, value: object): Promise<void>;

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
