import CacheEngineBase from '~/db/cache-engine-base';

class MemoryCacheEngine implements CacheEngineBase {
    // pass an empty(or existing) object as storage - MemoryCacheEngine will read and write objects to it
    constructor(name) {
        this.name = name;
        this.storage = MemoryCacheEngine.defaultStorage;
        if (!this.storage[name]) {
            this.storage[name] = {};
        }
    }

    static defaultStorage = {};

    static setStorage(val) {
        MemoryCacheEngine.defaultStorage = val;
    }

    name: string;
    storage: { [key: string]: {} };

    get db() {
        return this.storage[this.name];
    }

    open() {
        this.isOpen = true;
        return Promise.resolve();
    }

    getValue(key: string) {
        return new Promise(resolve => {
            setTimeout(() => resolve(this.db[key]));
        });
    }

    async setValue(key, value, callback) {
        let newVal = value;
        if (callback) {
            const old = await this.getValue(key);
            newVal = callback(old, value);
            if (!newVal) {
                console.log('cache update rejected');
                return Promise.resolve();
            }
        }
        return new Promise(resolve => {
            setTimeout(() => {
                this.db[key] = newVal;
                resolve();
            });
        });
    }

    removeValue(key) {
        return new Promise(resolve => {
            setTimeout(() => {
                delete this.db[key];
                resolve();
            });
        });
    }

    getAllKeys() {
        return new Promise(resolve => {
            setTimeout(() => resolve(Object.keys(this.db)));
        });
    }

    getAllValues() {
        return new Promise(resolve => {
            setTimeout(() => resolve(Object.values(this.db)));
        });
    }

    clear() {
        return new Promise(resolve => {
            this.storage[this.name] = {};
            setTimeout(resolve);
        });
    }
}

export default MemoryCacheEngine;
