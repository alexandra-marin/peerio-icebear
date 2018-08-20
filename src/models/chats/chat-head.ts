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

    /**
     * @type {string}
     */
    @observable chatName = '';
    /**
     * @type {string}
     */
    @observable purpose = '';

    /** SPACE PROPERTIES */
    /**
     * @type {string}
     */
    @observable spaceId = null;

    /**
     * @type {string}
     */
    @observable spaceName = null;

    /**
     * @type {string}
     */
    @observable nameInSpace = null;

    /**
     * @type {string}
     */
    @observable spaceDescription = null;

    /**
     * @type {enum: internal / patient}
     */
    @observable spaceRoomType = null;

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
