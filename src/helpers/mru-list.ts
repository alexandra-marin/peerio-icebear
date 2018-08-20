import TinyDb from '../db/tiny-db';
import { throttle } from 'lodash';
import { observable, action, IObservableArray } from 'mobx';
/**
 * Base class for any Most Recently Used implementations.
 * Gotcha: Don't create 2+ instances for the same list name. Due to caching it will lead to conflicts.
 * @param name - unique name for the list
 * @param limit - maximum number of elements in the list (will remove least recent)
 */
class MRUList {
    constructor(name: string, limit = 10) {
        this._name = `MRU_${name}`;
        this._limit = limit;
    }
    _name: string;
    _limit: number;

    /**
     * Observable list of current MRU list. Readonly.
     */
    @observable.shallow list = [] as IObservableArray<string>;

    /**
     * Loads cached list from current user's TinyDb.
     * Normally you call this once, after user has been authenticated.
     * In case an instance is created before that, loadCache() is not called automatically.
     */
    async loadCache() {
        const list = await TinyDb.user.getValue(this._name);
        if (list) this.list = list;
    }

    _saveCache = throttle(() => {
        return TinyDb.user.setValue(this._name, this.list.peek());
    }, 3000);

    /**
     * Adds item usage fact to the list. Saves it to TinyDb in a throttled manner.
     */
    @action
    addItem(item: string) {
        this.list.remove(item);
        this.list.unshift(item);
        this.list.splice(this._limit);
        this._saveCache();
    }
}

export default MRUList;
