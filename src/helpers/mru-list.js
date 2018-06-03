const TinyDb = require('../db/tiny-db');
const _ = require('lodash');
const { observable, action } = require('mobx');
/**
 * Base class for any Most Recently Used implementations.
 * Gotcha: Don't create 2+ instances for the same list name. Due to caching it will lead to conflicts.
 * @param {string} name - unique name for the list
 * @param {number} [limit] - maximum number of elements in the list (will remove least recent)
 */
class MRUList {
    constructor(name, limit = 10) {
        this._name = `MRU_${name}`;
        this._limit = limit;
    }

    /**
     * Observable list of current MRU list. Readonly.
     * @member {ObservableArray<string>} list
     */
    @observable.shallow list = [];
    _name;
    _limit;

    /**
     * Loads cached list from current user's TinyDb.
     * Normally you call this once, after user has been authenticated.
     * In case an instance is created before that, loadCache() is not called automatically.
     */
    async loadCache() {
        const list = await TinyDb.user.getValue(this._name);
        if (list) this.list = list;
    }

    /**
     */
    _saveCache = _.throttle(() => {
        return TinyDb.user.setValue(this._name, this.list.peek());
    }, 3000);


    /**
     * Adds item usage fact to the list. Saves it to TinyDb in a throttled manner.
     * @function addItem
     * @param {string} item
     */
    @action addItem(item) {
        this.list.remove(item);
        this.list.unshift(item);
        this.list.splice(this._limit);
        this._saveCache();
    }
}

module.exports = MRUList;
