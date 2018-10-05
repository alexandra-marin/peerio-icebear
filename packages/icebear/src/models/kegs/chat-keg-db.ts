import SharedKegDb from '../kegs/shared-keg-db';

/*
 * KegDB for chats and rooms.
 */
class ChatKegDb extends SharedKegDb {
    constructor(id, participants = [], isChannel = false, onBootKegLoadedFromKeg) {
        super(id, participants, isChannel, onBootKegLoadedFromKeg);
    }

    get urlName() {
        return this.isChannel ? 'channel' : 'chat';
    }
}

export default ChatKegDb;
