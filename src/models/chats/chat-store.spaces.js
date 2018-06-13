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

    createNewInternalRoom = () => { this.createRoomInPatientSpace('internal'); }
    createNewPatientRoom = () => { this.createRoomInPatientSpace('patient'); }

    /**
     * @returns {Chat}
     */
    createRoomInPatientSpace = async (SPACE, type) => {
        const roomSpaceProperties = {
            spaceId: SPACE.currentSpace.spaceId,
            spaceName: SPACE.currentSpace.spaceName,
            nameInSpace: this.channelName,
            spaceDescription: SPACE.currentSpace.spaceDescription,
            spaceRoomType: type
        };

        const name = `${SPACE.currentSpace.spaceName} - ${this.channelName}`;
        const chat = await this.startChat(this.userPicker.selected, true, name, '', true, roomSpaceProperties);

        return chat;
        // if (!chat) {
        //     this.waiting = false;
        //     return;
        // }
        // when(() => chat.added === true, () => {
        //     routerStore.navigateTo(routerStore.ROUTES.patients);
        // });
    }
}

module.exports = ChatStoreSpaces;
