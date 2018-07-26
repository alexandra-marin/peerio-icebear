const socket = require('../network/socket');

/**
 * Provides easy access to the list of user's keg database ids.
 * Retrieves the list only once and caches it.
 */
class KegDbListProvider {
    constructor() {
        socket.onAuthenticated(() => {
            this.prevCachedList = this.cachedList;
            this.cachedList = null;
            this.cacheList();
        });
    }

    loadingPromise = null;
    cachedList = null;

    dbAddedHandlers = [];
    dbRemovedHandlers = [];

    async cacheList() {
        if (this.loadingPromise) return this.loadingPromise;
        if (this.cachedList) return this.cachedList;
        this.loadingPromise =
            socket.send('/auth/kegs/user/dbs')
                .then(list => {
                    this.loadingPromise = null;
                    this.cachedList = list;
                    this.compareChanges();
                });

        return this.loadingPromise;
    }
    compareChanges() {
        if (!this.cachedList || !this.prevCachedList) return;
        for (const id of this.cachedList) {
            if (!this.prevCachedList.includes(id)) {
                this.dbAddedHandlers.forEach(h => h(id));
            }
        }
        for (const id of this.prevCachedList) {
            if (!this.cachedList.includes(id)) {
                this.dbRemovedHandlers.forEach(h => h(id));
            }
        }
    }

    async filterBy(dbType) {
        await this.cacheList();
        return this.cachedList.filter(item => item.startsWith(dbType));
    }

    getDMs() {
        return this.filterBy('chat:');
    }

    getChannels() {
        return this.filterBy('channel:');
    }

    getVolumes() {
        return this.filterBy('volume:');
    }

    onDbAdded(handler) {
        this.dbAddedHandlers.push(handler);
    }

    onDbRemoved(handler) {
        this.dbRemovedHandlers.push(handler);
    }
}

module.exports = new KegDbListProvider();
