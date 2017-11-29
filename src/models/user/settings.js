const Keg = require('../kegs/keg');
const { observable } = require('mobx');

/**
 * Plaintext named system keg, server controlled.
 * User can update this keg, but server verifies contract.
 * @extends {Keg}
 * @param {User} user
 * @public
 */
class Settings extends Keg {
    /**
     * @member {boolean} contactNotifications
     * @memberof Settings
     * @instance
     * @public
     */
    @observable contactNotifications = false;
    /**
     * @member {boolean} contactRequestNotifications
     * @memberof Settings
     * @instance
     * @public
     */
    @observable contactRequestNotifications = false;
    /**
     * @member {boolean} messageNotifications
     * @memberof Settings
     * @instance
     * @public
     */
    @observable messageNotifications = false;
    /**
     * @member {boolean} errorTracking
     * @memberof Settings
     * @instance
     * @public
     */
    @observable errorTracking = false;
    /**
     * @member {boolean} dataCollection
     * @memberof Settings
     * @instance
     * @public
     */
    @observable dataCollection = false;
    /**
     * @member {boolean} subscribeToPromoEmails
     * @memberof Settings
     * @instance
     * @public
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
