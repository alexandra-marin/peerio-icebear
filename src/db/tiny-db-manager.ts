import TinyDbImplementation from '~/db/tiny-db-implementation';
import { TinyDBStorageEngine } from '~/defs/tiny-db';

/**
 * TinyDbManager manages system and user instances, and allows opening
 * other instances.
 * @param createStorageEngine - function returning a new storage engine for the name
 */
class TinyDbManager {
    constructor(createStorageEngine: (name: string) => TinyDBStorageEngine) {
        this.createStorageEngine = createStorageEngine;
        this.systemInstance = null;
        this.userInstance = null;
    }

    createStorageEngine: (name: string) => TinyDBStorageEngine;
    systemInstance: TinyDbImplementation;
    userInstance: TinyDbImplementation;

    /**
     * Instance of unencrypted system instance.
     */
    get system() {
        if (!this.systemInstance) this.openSystem();
        return this.systemInstance;
    }

    /**
     * Instance of encrypted user instance.
     * Only values are encrypted.
     */
    get user() {
        return this.userInstance;
    }

    /**
     * Creates a instance instance.
     * @param name - database name
     * @param encryptionKey - optional encryption key
     */
    open(name: string, encryptionKey?: Uint8Array): TinyDbImplementation {
        const engine = this.createStorageEngine(name);
        return new TinyDbImplementation(engine, name, encryptionKey);
    }

    /**
     * Creates system instance instance and assigns it to {@link system} property
     * @returns system instance
     */
    openSystem(): TinyDbImplementation {
        this.systemInstance = this.open('$system$');
        return this.systemInstance;
    }

    /**
     * Creates user instance instance and assigns it to {@link user} property
     * @param  username
     * @param  encryptionKey - database key
     * @returns user instance
     */
    openUser(username: string, encryptionKey: Uint8Array): TinyDbImplementation {
        this.userInstance = this.open(username, encryptionKey);
        return this.userInstance;
    }
}

export default TinyDbManager;
