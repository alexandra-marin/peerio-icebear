const config = require('../../config');
const { getUser } = require('../../helpers/di-current-user');

class ChatStoreCache {
    /** @param {ChatStore} store */
    constructor(store) {
        this.store = store;
    }

    async open() {
        if (!this.cache) {
            this.cache = new config.CacheEngine(`peerio_${getUser().username}_chat_store`, 'kegDbId');
            await this.cache.open();
        }
    }

    async saveMeta(kegDbId, rawMeta) {
        return this.cache.setValue(kegDbId,
            { kegDbId, rawMeta },
            (oldObj, newObj) => {
                if (!oldObj) return newObj;
                oldObj.rawMeta = rawMeta;
                return oldObj;
            });
    }

    async saveBootKeg(kegDbId, bootKeg) {
        return this.cache.setValue(kegDbId,
            { kegDbId, bootKeg },
            (oldObj, newObj) => {
                if (!oldObj) return newObj;
                if (!oldObj.bootKeg || oldObj.bootKeg.collectionVersion <= bootKeg.collectionVersion) {
                    oldObj.bootKeg = bootKeg;
                }
                return oldObj;
            });
    }
    async saveChatHead(kegDbId, chatHead) {
        return this.cache.setValue(kegDbId,
            { kegDbId, chatHead },
            (oldObj, newObj) => {
                if (!oldObj) return newObj;
                if (!oldObj.chatHead || oldObj.chatHead.collectionVersion <= chatHead.collectionVersion) {
                    oldObj.chatHead = chatHead;
                }
                return oldObj;
            });
    }

    async loadData(kegDbId) {
        return this.cache.getValue(kegDbId);
    }
}

module.exports = ChatStoreCache;
