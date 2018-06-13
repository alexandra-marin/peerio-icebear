const { computed, observable } = require('mobx');
const config = require('../../config');

class Space {
    constructor(store) {
        this.store = store;
    }

    spaceId = '';
    spaceName = '';
    spaceDescription = '';

    @computed get allRooms() {
        return this.store.channels
            .filter(c => c.isInSpace)
            .filter(c => c.chatHead.spaceId === this.spaceId);
    }

    @computed get internalRooms() {
        return this.allRooms.filter(c => c.chatHead.spaceRoomType === 'internal');
    }

    @computed get patientRooms() {
        return this.allRooms.filter(c => c.chatHead.spaceRoomType === 'patient');
    }

    @observable isNew = false;

    countUnread = (count, room) => count + room.unreadCount;
    @computed get unreadCount() {
        const internalRoomsUnread = this.internalRooms.reduce(this.countUnread, 0);
        const patientRoomsUnread = this.patientRooms.reduce(this.countUnread, 0);

        return internalRoomsUnread + patientRoomsUnread;
    }
}

class ChatStoreSpaces {
    constructor(store) {
        this.store = store;
    }

    @computed get roomsWithinSpaces() {
        return this.store.channels.filter(chat => chat.isInSpace);
    }

    @computed get spaces() {
        if (config.whiteLabel.name !== 'medcryptor') {
            return [];
        }

        // aggregate all spaces by id
        const spacesMap = new Map(this.roomsWithinSpaces.map(chat => [
            chat.chatHead.spaceId, // key: the space's id
            this.getSpaceFrom(chat) // value: the space object
        ]));

        // return all unique spaces as array
        const spaces = [...spacesMap.values()].sort((a, b) => {
            return a.spaceName.localeCompare(b.spaceName);
        });

        return spaces;
    }

    getSpaceFrom = (chat) => {
        const space = new Space(this.store); // eslint-disable-line
        space.spaceId = chat.chatHead.spaceId;
        space.spaceName = chat.chatHead.spaceName;
        space.spaceDescription = chat.chatHead.spaceDescription;

        return space;
    }

    /**
     * @returns {Chat}
     */
    createRoomInPatientSpace = async (space, roomName, roomType, participants) => {
        const roomSpaceProperties = {
            spaceId: space.currentSpace.spaceId,
            spaceName: space.currentSpace.spaceName,
            nameInSpace: roomName,
            spaceDescription: space.currentSpace.spaceDescription,
            spaceRoomType: roomType
        };

        const name = `${space.currentSpace.spaceName} - ${roomName}`;
        const chat = await this.startChat(participants, true, name, '', true, roomSpaceProperties);

        return chat;
    }
}

module.exports = ChatStoreSpaces;
