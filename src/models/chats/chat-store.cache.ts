import config from '../../config';
import { ChatStore } from './chat-store';
import CacheEngineBase from '../../db/cache-engine-base';

class ChatStoreCache {
    constructor(store: ChatStore) {
        this.store = store;
    }

    store: ChatStore;
    cache: CacheEngineBase<any>; // TODO: raw meta type

    async open() {
        if (!this.cache) {
            this.cache = new config.CacheEngine('chat_store', 'kegDbId');
            await this.cache.open();
        }
    }

    async saveMeta(kegDbId, rawMeta) {
        return this.cache.setValue(kegDbId, { kegDbId, rawMeta }, (oldObj, newObj) => {
            if (!oldObj) return newObj;
            oldObj.rawMeta = rawMeta;
            return oldObj;
        });
    }

    async saveBootKeg(kegDbId, bootKeg) {
        return this.cache.setValue(kegDbId, { kegDbId, bootKeg }, (oldObj, newObj) => {
            if (!oldObj) return newObj;
            if (!oldObj.bootKeg || oldObj.bootKeg.collectionVersion <= bootKeg.collectionVersion) {
                oldObj.bootKeg = bootKeg;
            }
            return oldObj;
        });
    }
    async saveChatHead(kegDbId, chatHead) {
        return this.cache.setValue(kegDbId, { kegDbId, chatHead }, (oldObj, newObj) => {
            if (!oldObj) return newObj;
            if (
                !oldObj.chatHead ||
                oldObj.chatHead.collectionVersion <= chatHead.collectionVersion
            ) {
                oldObj.chatHead = chatHead;
            }
            return oldObj;
        });
    }

    async loadData(kegDbId) {
        return this.cache.getValue(kegDbId);
    }
}

export default ChatStoreCache;
