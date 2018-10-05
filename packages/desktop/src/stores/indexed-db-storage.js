const { CacheEngineBase } = require('peerio-icebear');

class IndexedDbStorage extends CacheEngineBase {
    constructor(name, keyPath) {
        super(name, keyPath);
        this._stores = [this.name]; //  a little optimization to avoid creating arrays all the time
    }

    getStore(readonly) {
        return this.db
            .transaction(this._stores, readonly ? 'readonly' : 'readwrite')
            .objectStore(this.name);
    }

    openInternal() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.name, 1);
            req.onerror = ev => {
                console.error('Error opening IndexedDb');
                console.error(ev);
                reject(ev);
            };
            req.onsuccess = ev => {
                this.db = ev.target.result;
                resolve();
            };
            req.onupgradeneeded = ev => {
                ev.target.result.createObjectStore(this.name, {
                    keyPath: this.keyPath
                });
            };
        });
    }

    getValue(key) {
        return new Promise((resolve, reject) => {
            const request = this.getStore(true).get(key);
            request.onerror = reject;
            request.onsuccess = function() {
                resolve(request.result);
            };
        });
    }

    setValue(key, value, confirmUpdate) {
        return new Promise((resolve, reject) => {
            if (!confirmUpdate) {
                const request = this.getStore().put(value);
                request.onsuccess = resolve;
                request.onerror = reject;
                return;
            }
            const store = this.getStore();
            const getRequest = store.get(key);
            getRequest.onsuccess = function() {
                const confirmed = confirmUpdate(getRequest.result, value);
                if (!confirmed) {
                    reject(new Error('Cache storage caller denied update.'));
                    return;
                }
                const request = store.put(confirmed);
                request.onsuccess = resolve;
                request.onerror = reject;
            };
            getRequest.onerror = reject;
        });
    }

    removeValue(key) {
        return new Promise((resolve, reject) => {
            const request = this.getStore().delete(key);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }

    getAllKeys() {
        return new Promise((resolve, reject) => {
            const ret = [];
            const cur = this.getStore().openCursor();
            cur.onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    ret.push(cursor.key);
                    cursor.continue();
                } else {
                    resolve(ret);
                }
            };
            cur.onerror = reject;
        });
    }

    getAllValues() {
        return new Promise((resolve, reject) => {
            const ret = [];
            const cur = this.getStore().openCursor();
            cur.onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    ret.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(ret);
                }
            };
            cur.onerror = reject;
        });
    }

    clear() {
        return new Promise((resolve, reject) => {
            const request = this.getStore().clear();
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    }

    async deleteDatabase(name) {
        return indexedDB.deleteDatabase(name);
    }
}

module.exports = IndexedDbStorage;
