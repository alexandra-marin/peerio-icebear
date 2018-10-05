import { observable, action } from 'mobx';
import socket from '../../network/socket';
import { getUser } from '../../helpers/di-current-user';
import Tofu from './tofu';
import config from '../../config';
import { asPromise } from '../../helpers/prombservable';
import { retryUntilSuccess } from '../../helpers/retry';
import CacheEngineBase from '../../db/cache-engine-base';

export class TofuStore {
    @observable loaded = false;
    loading = false;
    // TODO: raw keg types
    cache: CacheEngineBase<any>;
    cacheMeta: CacheEngineBase<{ key: string; value: string }>;

    @action.bound
    async load() {
        if (this.loading || this.loaded) return;
        this.loading = true;
        this.cache = new config.CacheEngine('tofu', 'username');
        await this.cache.open();
        this.cacheMeta = new config.CacheEngine('tofu_meta', 'key');
        await this.cacheMeta.open();
        while (await this.loadTofuKegs()) {
            console.log('Loaded a page of tofu kegs from server.');
        }
        this.loaded = true;
        this.loading = false;
    }

    async getKnownUpdateId() {
        const data = (await this.cacheMeta.getValue('knownUpdateId')) as { value: string };
        if (!data) return '';
        return data.value;
    }

    saveKnownUpdateId(updateId) {
        return this.cacheMeta.setValue('knownUpdateId', {
            key: 'knownUpdateId',
            value: updateId
        });
    }

    async loadTofuKegs() {
        let knownUpdateId = await this.getKnownUpdateId();
        let resp;
        try {
            resp = await retryUntilSuccess(
                () => {
                    return socket.send('/auth/kegs/db/list-ext', {
                        kegDbId: 'SELF',
                        options: {
                            type: 'tofu'
                        },
                        filter: { collectionVersion: { $gt: knownUpdateId } }
                    });
                },
                {
                    id: 'loading tofu kegs',
                    maxRetries: 10
                }
            );
        } catch (err) {
            console.error(err);
        }
        if (!resp || !resp.kegs || !resp.kegs.length) return false;
        for (const keg of resp.kegs) {
            if (keg.collectionVersion > knownUpdateId) {
                knownUpdateId = keg.collectionVersion;
            }
            const tofu = new Tofu(getUser().kegDb);
            if (await tofu.loadFromKeg(keg)) {
                this.cacheTofu(tofu);
            }
        }
        await this.saveKnownUpdateId(knownUpdateId);
        return true;
    }

    // we don't need to wait for tofu keg to get signature verified, because it exists only in SELF
    cacheTofu(tofu) {
        if (!tofu.encryptionPublicKey || !tofu.signingPublicKey) {
            // Broken keg? Don't cache.
            return;
        }
        this.cache
            .setValue(tofu.username, tofu.serializeKegPayload())
            .catch(this.processCacheUpdateError);
    }
    processCacheUpdateError(err) {
        console.error(err);
    }

    async getFromCache(username) {
        // TODO: raw keg types
        const cached = await this.cache.getValue(username);
        if (cached && (!cached.encryptionPublicKey || !cached.signingPublicKey)) {
            // Broken cached tofu.
            return null;
        }
        return cached;
    }

    /**
     * Finds Tofu keg by username property.
     * @param  username
     * @returns tofu keg, if any
     */
    @action.bound
    async getByUsername(username: string): Promise<Tofu> {
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
                () =>
                    socket.send(
                        '/auth/kegs/db/list-ext',
                        {
                            kegDbId: 'SELF',
                            options: {
                                type: 'tofu',
                                reverse: false
                            },
                            filter: { username }
                        },
                        false
                    ),
                { maxRetries: 10 }
            );
        } catch (err) {
            console.error(err);
            return null;
        }
        if (!resp.kegs || !resp.kegs.length) return null;

        const tofu = new Tofu(getUser().kegDb);
        if (!(await tofu.loadFromKeg(resp.kegs[0]))) {
            // TODO: detect and delete excess? shouldn't really happen though
            console.error('Failed to load tofu keg');
            return null;
        }
        this.cacheTofu(tofu);
        return tofu;
    }

    getUsernames() {
        return this.cache.getAllKeys() || ([] as string[]);
    }
}

const tofuStore = new TofuStore();

socket.onAuthenticated(tofuStore.load);

export default tofuStore;
