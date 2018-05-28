const { computed } = require('mobx');
const config = require('../../config');

class Space {
    spaceId = '';
    spaceName = '';
    spaceDescription = '';
    isNew = false;
    internalRooms = [];
    patientRooms = [];
    @computed get unreadCount() {
        return 0; // TODO
    }
}

class ChatStoreSpaces {
    constructor(store) {
        this.store = store;
    }

    @computed
    get spaces() {
        if (config.appLabel !== 'medcryptor') {
            return [];
        }

        // get all channels that belong to a space
        const channelsFromASpace = this.store.chats.filter(chat => chat.isChannel && chat.isInSpace);

        // aggregate all spaces by name
        const spacesMap = new Map(channelsFromASpace.map(chat => [
            chat.chatHead.spaceName, this.getSpaceFromChat(chat)]));

        // return all unique spaces
        const spaces = [...spacesMap.values()];

        return spaces;
    }

    getSpaceFromChat(chat) {
        const space = new Space();
        space.spaceId = chat.chatHead.spaceId;
        space.spaceName = chat.chatHead.spaceName;
        space.spaceDescription = chat.chatHead.spaceDescription;

        const allSpaceRooms = this.store.chats
            .filter(c => c.isChannel)
            .filter(c => c.isInSpace)
            .filter(c => c.chatHead.spaceId === chat.chatHead.spaceId);

        space.internalRooms = allSpaceRooms.filter(c => c.chatHead.spaceRoomType === 'internal');
        space.patientRooms = allSpaceRooms.filter(c => c.chatHead.spaceRoomType === 'patient');

        return space;
    }
}

module.exports = ChatStoreSpaces;
