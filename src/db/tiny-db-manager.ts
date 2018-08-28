import TinyDbCollection from './tiny-db-collection';

/**
 * TinyDbManager manages system and user collections, and allows opening
 * other collections.
 * @param createStorageEngine - function returning a new storage engine for the name
 */
class TinyDbManager {
    constructor(createStorageEngine: () => StorageEngine) {
        this.createStorageEngine = createStorageEngine;
        this.systemCollection = null;
        this.userCollection = null;
    }

    /**
     * Instance of unencrypted system collection.
     */
    get system(): TinyDbCollection {
        if (!this.systemCollection) this.openSystem();
        return this.systemCollection;
    }

    /**
     * Instance of encrypted user collection.
     * Only values are encrypted.
     */
    get user(): TinyDb {
        return this.userCollection;
    }

    /**
     * Creates a collection instance.
     * @param name - database name
     * @param encryptionKey - optional encryption key
     */
    open(name: string, encryptionKey?: Uint8Array): TinyDbCollection {
        const engine = this.createStorageEngine(name);
        return new TinyDbCollection(engine, name, encryptionKey);
    }

    /**
     * Creates system collection instance and assigns it to {@link system} property
     * @returns system collection
     */
    openSystem(): TinyDbCollection {
        this.systemCollection = this.open('$system$');
        return this.systemCollection;
    }

    /**
     * Creates user collection instance and assigns it to {@link user} property
     * @param  username
     * @param  encryptionKey - database key
     * @returns user collection
     */
    openUser(username: string, encryptionKey: Uint8Array): TinyDbCollection {
        this.userCollection = this.open(username, encryptionKey);
        return this.userCollection;
    }
}

export default TinyDbManager;
