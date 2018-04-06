const SharedKegDb = require('../kegs/shared-keg-db');

/*
 * KegDB for chats and rooms.
 */
class ChatKegDb extends SharedKegDb {
    constructor(id, participants = [], isChannel = false) {
        super(id, participants, isChannel);
    }

    get urlName() {
        return this.isChannel ? 'channel' : 'chat';
    }
}

module.exports = ChatKegDb;
