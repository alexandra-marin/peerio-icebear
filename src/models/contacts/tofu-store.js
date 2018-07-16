const { observable, action } = require('mobx');
const socket = require('../../network/socket');
const { getUser } = require('../../helpers/di-current-user');
const Tofu = require('./tofu');
const config = require('../../config');
const { asPromise } = require('../../helpers/prombservable');
const { retryUntilSuccess } = require('../../helpers/retry');
const { getCacheDbFullName } = require('../../util');

class TofuStore {
    @observable loaded = false;
    loading = false;

    @action.bound async load() {
        if (this.loading || this.loaded) return;
        this.loading = true;
        this.cache = new config.CacheEngine(getCacheDbFullName('tofu'), 'username');
        await this.cache.open();
        this.cacheMeta = new config.CacheEngine(getCacheDbFullName('tofu_meta'), 'key');
        await this.cacheMeta.open();
        while (await this.loadTofuKegs()) {
            console.log('Loaded a page of tofu kegs from server.');
        }
        this.loaded = true;
        this.loading = false;
    }

    async getKnownUpdateId() {
        const data = await this.cacheMeta.getValue('knownUpdateId');
        if (!data) return '';
        return data.value;
    }

    saveKnownUpdateId(updateId) {
        return this.cacheMeta.setValue('knownUpdateId', { key: 'knownUpdateId', value: updateId });
    }

    async loadTofuKegs() {
        let knownUpdateId = await this.getKnownUpdateId();
        let resp;
        try {
            resp = await retryUntilSuccess(() => {
                return socket.send('/auth/kegs/db/list-ext', {
                    kegDbId: 'SELF',
                    options: {
                        type: 'tofu'
                    },
                    filter: { collectionVersion: { $gt: knownUpdateId } }
                });
            }, 'loading tofu kegs', 10);
        } catch (err) {
            console.error(err);
        }
        if (!resp || !resp.kegs || !resp.kegs.length) return false;
        resp.kegs.forEach(keg => {
            if (keg.collectionVersion > knownUpdateId) {
                knownUpdateId = keg.collectionVersion;
            }
            const tofu = new Tofu(getUser().kegDb);
            if (tofu.loadFromKeg(keg)) {
                this.cacheTofu(tofu);
            }
        });
        await this.saveKnownUpdateId(knownUpdateId);
        return true;
    }

    // we don't need to wait for tofu keg to get signature verified, because it exists only in SELF
    cacheTofu(tofu) {
        this.cache.setValue(tofu.username, tofu.serializeKegPayload())
            .catch(this.processCacheUpdateError);
    }
    processCacheUpdateError(err) {
        console.error(err);
    }

    getFromCache(username) {
        return this.cache.getValue(username);
    }

    /**
     * Finds Tofu keg by username property.
     * @param {string} username
     * @returns {Promise<?Tofu>} tofu keg, if any
     */
    @action.bound async getByUsername(username) {
        if (!this.loaded) {
            await asPromise(this, 'loaded', true);
        }
        const cached = await this.getFromCache(username);
        if (cached) {
            return cached; // it's not a keg, but we currently use it only for a few properties (when loaded from cache)
        }

        let resp;
        try {
            resp = await retryUntilSuccess(
                () => socket.send('/auth/kegs/db/list-ext', {
                    kegDbId: 'SELF',
                    options: {
                        type: 'tofu',
                        reverse: false
                    },
                    filter: { username }
                }, false),
                null,
                10);
        } catch (err) {
            console.error(err);
            return null;
        }
        if (!resp.kegs || !resp.kegs.length) return null;

        const tofu = new Tofu(getUser().kegDb);
        tofu.loadFromKeg(resp.kegs[0]); // TODO: detect and delete excess? shouldn't really happen though
        this.cacheTofu(tofu);
        return tofu;
    }

    getUsernames() {
        return this.cache.getAllKeys() || [];
    }
}

const tofuStore = new TofuStore();

socket.onAuthenticated(tofuStore.load);

module.exports = tofuStore;
