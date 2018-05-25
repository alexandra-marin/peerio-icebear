const { retryUntilSuccess } = require('./retry');
const socket = require('../network/socket');

/**
 * Provides easy access to the list of user's keg database ids.
 * Retrieves the list only once and caches it.
 */
class KegDbListProvider {
    loadingPromise = null;
    cachedList = null;

    cacheList() {
        if (this.loadingPromise) return this.loadingPromise;
        this.loadingPromise = retryUntilSuccess(() =>
            socket.send('/auth/kegs/user/dbs')
                .then(list => {
                    this.cachedList = list;
                })
        );
        return this.loadingPromise;
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
}

module.exports = new KegDbListProvider();
