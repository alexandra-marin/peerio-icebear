const SyncedKeg = require('../kegs/synced-keg');
const { observable } = require('mobx');

/**
 * Chat head keg is open for any chat participant to update.
 * @param {ChatKegDb} db
 * @extends SyncedKeg
 * @public
 */
class ChatHead extends SyncedKeg {
    constructor(db) {
        super('chat_head', db);
    }

    /**
     * @member {string} chatName
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable chatName = '';
    /**
     * @member {string} purpose
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable purpose = '';


    /** SPACE PROPERTIES */
    /**
     * @member {string} spaceId
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable spaceId = null;

    /**
     * @member {string} spaceName
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable spaceName = null;

    /**
     * @member {string} spaceDescription
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable spaceDescription = null;

    /**
     * @member {enum: internal / patient} spaceType
     * @memberof ChatHead
     * @instance
     * @public
     */
    @observable spaceType = null;


    serializeKegPayload() {
        return {
            chatName: this.chatName,
            purpose: this.purpose,
            spaceId: this.spaceId,
            spaceName: this.spaceName,
            spaceDescription: this.spaceDescription,
            spaceType: this.spaceType
        };
    }

    deserializeKegPayload(payload) {
        this.chatName = payload.chatName || '';
        this.purpose = payload.purpose || '';
        this.spaceId = payload.spaceId || null;
        this.spaceName = payload.spaceName || null;
        this.spaceDescription = payload.spaceDescription || null;
        this.spaceType = payload.spaceType || null;
    }
}


module.exports = ChatHead;
