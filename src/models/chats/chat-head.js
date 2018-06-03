const SyncedKeg = require('../kegs/synced-keg');
const { observable } = require('mobx');

/**
 * Chat head keg is open for any chat participant to update.
 * @param {ChatKegDb} db
 * @extends SyncedKeg
 */
class ChatHead extends SyncedKeg {
    constructor(db) {
        super('chat_head', db);
    }

    /**
     * @member {string} chatName
     */
    @observable chatName = '';
    /**
     * @member {string} purpose
     */
    @observable purpose = '';


    serializeKegPayload() {
        return {
            chatName: this.chatName,
            purpose: this.purpose
        };
    }

    deserializeKegPayload(payload) {
        this.chatName = payload.chatName || '';
        this.purpose = payload.purpose || '';
    }
}


module.exports = ChatHead;
