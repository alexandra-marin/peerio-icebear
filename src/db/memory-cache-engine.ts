import StorageEngineInterface from './storage-engine-inteface';

// Use this with tests

export default class MemoryCacheEngine implements StorageEngineInterface {
    readonly namespace: string;
    readonly storage: { [namespace: string]: { [key: string]: string } };

    constructor(namespace: string) {
        this.namespace = namespace;
        this.storage = MemoryCacheEngine.defaultStorage;
        if (!this.storage[namespace]) {
            this.storage[namespace] = {};
        }
    }

    static defaultStorage = {};

    static setStorage(val): void {
        MemoryCacheEngine.defaultStorage = val;
    }

    get db() {
        return this.storage[this.namespace];
    }

    open(): Promise<void> {
        return Promise.resolve();
    }

    getValue(key: string): Promise<string> {
        return new Promise(resolve => {
            setTimeout(() => resolve(this.db[key]));
        });
    }

    async setValue(
        key: string,
        value: string,
        callback?: (old: string, value: string) => string
    ): Promise<void> {
        let newVal = value;
        if (callback) {
            const old = await this.getValue(key);
            newVal = callback(old, value);
            if (!newVal) {
                console.log('cache update rejected');
                return Promise.resolve();
            }
        }
        return new Promise<void>(resolve => {
            setTimeout(() => {
                this.db[key] = newVal;
                resolve();
            });
        });
    }

    removeValue(key: string): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => {
                delete this.db[key];
                resolve();
            });
        });
    }

    getAllKeys(): Promise<string[]> {
        return new Promise(resolve => {
            setTimeout(() => resolve(Object.keys(this.db)));
        });
    }

    getAllValues(): Promise<string[]> {
        return new Promise(resolve => {
            setTimeout(() => resolve(Object.values(this.db)));
        });
    }

    clear(): Promise<void> {
        return new Promise(resolve => {
            this.storage[this.namespace] = {};
            setTimeout(resolve);
        });
    }
}
