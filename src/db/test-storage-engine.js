// Use this with tests

class TestStorageEngine {
    // pass an empty(or existing) object as storage - TestStorageEngine will read and write objects to it
    constructor(namespace) {
        this.namespace = namespace;
        this.storage = TestStorageEngine.defaultStorage;
        if (!this.storage[namespace]) {
            this.storage[namespace] = {};
        }
    }

    static defaultStorage = {};

    static setStorage(val) {
        TestStorageEngine.defaultStorage = val;
    }

    get db() {
        return this.storage[this.namespace];
    }

    getValue(key) {
        return new Promise(resolve => {
            setTimeout(() => resolve(this.db[key]));
        });
    }

    async setValue(key, value) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.db[key] = value;
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

module.exports = TestStorageEngine;
