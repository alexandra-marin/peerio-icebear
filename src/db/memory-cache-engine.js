// Use this with tests

class MemoryCacheEngine {
    // pass an empty(or existing) object as storage - MemoryCacheEngine will read and write objects to it
    constructor(namespace) {
        this.namespace = namespace;
        this.storage = MemoryCacheEngine.defaultStorage;
        if (!this.storage[namespace]) {
            this.storage[namespace] = {};
        }
    }

    static defaultStorage = {};

    static setStorage(val) {
        MemoryCacheEngine.defaultStorage = val;
    }

    get db() {
        return this.storage[this.namespace];
    }

    openInternal() {
        return Promise.resolve();
    }

    getValue(key) {
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
            this.storage[this.namespace] = {};
            setTimeout(resolve);
        });
    }
}

module.exports = MemoryCacheEngine;
