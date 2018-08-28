const Keg = require('../kegs/keg');
const { observable } = require('mobx');

/**
 * Plaintext named system keg, server controlled.
 * User can update this keg, but server verifies contract.
 * @extends {Keg}
 * @param {User} user
 */
class Settings extends Keg {
    /**
     * @type {boolean}
     */
    @observable contactNotifications = false;
    /**
     * @type {boolean}
     */
    @observable contactRequestNotifications = false;
    /**
     * @type {boolean}
     */
    @observable messageNotifications = false;
    /**
     * @type {boolean}
     */
    @observable dataCollection = false;
    /**
     * @type {boolean}
     */
    @observable subscribeToPromoEmails = false;

    @observable loaded = false;

    constructor(user) {
        super('settings', 'settings', user.kegDb, true);
        this.user = user;
    }

    serializeKegPayload() {
        return {
            contactNotifications: this.contactNotifications,
            contactRequestNotifications: this.contactRequestNotifications,
            messageNotifications: this.messageNotifications,
            dataCollectionOptIn: this.dataCollection,
            subscribeToPromoEmails: this.subscribeToPromoEmails
        };
    }

    deserializeKegPayload(data) {
        this.contactNotifications = data.contactNotifications;
        this.contactRequestNotifications = data.contactRequestNotifications;
        this.messageNotifications = data.messageNotifications;
        this.dataCollection = data.dataCollectionOptIn;
        this.subscribeToPromoEmails = data.subscribeToPromoEmails;
        this.loaded = true;
    }
}

module.exports = Settings;
