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
     * @member {boolean} contactNotifications
     */
    @observable contactNotifications = false;
    /**
     * @member {boolean} contactRequestNotifications
     */
    @observable contactRequestNotifications = false;
    /**
     * @member {boolean} messageNotifications
     */
    @observable messageNotifications = false;
    /**
     * @member {boolean} errorTracking
     */
    @observable errorTracking = false;
    /**
     * @member {boolean} dataCollection
     */
    @observable dataCollection = false;
    /**
     * @member {boolean} subscribeToPromoEmails
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
            errorTrackingOptIn: this.errorTracking,
            dataCollectionOptIn: this.dataCollection,
            subscribeToPromoEmails: this.subscribeToPromoEmails
        };
    }

    deserializeKegPayload(data) {
        this.contactNotifications = data.contactNotifications;
        this.contactRequestNotifications = data.contactRequestNotifications;
        this.messageNotifications = data.messageNotifications;
        this.errorTracking = data.errorTrackingOptIn;
        this.dataCollection = data.dataCollectionOptIn;
        this.subscribeToPromoEmails = data.subscribeToPromoEmails;
        this.loaded = true;
    }
}

module.exports = Settings;
