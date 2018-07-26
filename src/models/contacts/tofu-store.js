const { observable, action } = require('mobx');
const socket = require('../../network/socket');
const { getUser } = require('../../helpers/di-current-user');
const Tofu = require('./tofu');

class TofuStore {
    @observable loaded = false;
    loading = false;
    cache = {};
    preCacheRequests = [];

    // todo: paging
    @action.bound
    load() {
        if (this.loading || this.loaded) return;
        this.loading = true;

        console.log('Precaching tofu kegs');
        socket
            .send(
                '/auth/kegs/db/list-ext',
                {
                    kegDbId: 'SELF',
                    options: {
                        type: 'tofu',
                        reverse: false
                    }
                },
                false
            )
            .then(res => {
                if (!res.kegs || !res.kegs.length) {
                    return;
                }
                res.kegs.forEach(data => {
                    const keg = new Tofu(getUser().kegDb);
                    keg.loadFromKeg(data);
                    this.cache[keg.username] = keg;
                });

                this.preCacheRequests.forEach(u => {
                    u.resolve(this.cache[u.username]);
                });
                this.preCacheRequests = [];
            })
            .catch(err => {
                console.error(err);
                this.preCacheRequests.forEach(u => {
                    u.reject(err);
                });
                this.preCacheRequests = [];
            })
            .finally(() => {
                this.loaded = true;
                this.loading = false;
            });
    }

    /**
     * Finds Tofu keg by username property.
     * @param {string} username
     * @returns {Promise<?Tofu>} tofu keg, if any
     */
    @action.bound
    getByUsername(username) {
        if (!this.loaded) {
            return new Promise((resolve, reject) => {
                this.preCacheRequests.push({ username, resolve, reject });
            });
        }
        if (this.cache[username]) return Promise.resolve(this.cache[username]);
        return socket
            .send(
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
            )
            .then(res => {
                if (!res.kegs || !res.kegs.length) return null;
                const keg = new Tofu(getUser().kegDb);
                keg.loadFromKeg(res.kegs[0]); // TODO: detect and delete excess? shouldn't really happen though
                // we are caching it here. when updates are implemented later on
                // this should be taken into account when invalidating cache
                this.cache[username] = keg;
                return keg;
            });
    }

    get usernames() {
        return Object.keys(this.cache);
    }
}

const tofuStore = new TofuStore();

socket.onAuthenticated(tofuStore.load);

module.exports = tofuStore;
