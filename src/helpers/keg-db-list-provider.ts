import socket from '../network/socket';

type DbListEventHandler = (kegDbId: string) => void;

/**
 * Provides easy access to the list of user's keg database ids.
 * Retrieves the list only once and caches it.
 */
class KegDbListProvider {
    constructor() {
        socket.onAuthenticated(this.reload);
    }

    loadingPromise: Promise<void> = null;
    cachedList: string[] = null;
    prevCachedList: string[] = null;

    dbAddedHandlers: DbListEventHandler[] = [];
    dbRemovedHandlers: DbListEventHandler[] = [];

    reload = () => {
        if (this.loadingPromise) return this.loadingPromise;
        this.prevCachedList = this.cachedList;
        this.cachedList = null;
        return this.cacheList();
    };

    async cacheList() {
        if (this.loadingPromise) return this.loadingPromise;
        if (this.cachedList) return this.cachedList;
        this.loadingPromise = socket.send('/auth/kegs/user/dbs').then((list: string[]) => {
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

    onDbAdded(handler: DbListEventHandler) {
        this.dbAddedHandlers.push(handler);
    }

    onDbRemoved(handler: DbListEventHandler) {
        this.dbRemovedHandlers.push(handler);
    }

    onVolumeAdded(handler: DbListEventHandler) {
        this.onDbAdded(id => {
            if (id.startsWith('volume:')) handler(id);
        });
    }
}

export default new KegDbListProvider();
