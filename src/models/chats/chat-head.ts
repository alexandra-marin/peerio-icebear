import SyncedKeg from '../kegs/synced-keg';
import { observable } from 'mobx';

/**
 * Chat head keg is open for any chat participant to update.
 * @param {ChatKegDb} db
 * @extends SyncedKeg
 */
export default class ChatHead extends SyncedKeg {
    constructor(db, noSync = false) {
        super('chat_head', db, undefined, undefined, undefined, undefined, noSync);
    }

    @observable chatName = '';
    @observable purpose = '';

    /** SPACE PROPERTIES */
    @observable spaceId: string = null;
    @observable spaceName: string = null;
    @observable nameInSpace: string = null;
    @observable spaceDescription: string = null;
    @observable spaceRoomType: 'internal' | 'patient' = null;

    serializeKegPayload() {
        return {
            chatName: this.chatName,
            purpose: this.purpose,
            spaceId: this.spaceId,
            spaceName: this.spaceName,
            nameInSpace: this.nameInSpace,
            spaceDescription: this.spaceDescription,
            spaceRoomType: this.spaceRoomType
        };
    }

    deserializeKegPayload(payload) {
        this.chatName = payload.chatName || '';
        this.purpose = payload.purpose || '';
        this.spaceId = payload.spaceId;
        this.spaceName = payload.spaceName;
        this.nameInSpace = payload.nameInSpace;
        this.spaceDescription = payload.spaceDescription;
        this.spaceRoomType = payload.spaceRoomType;
    }
}
