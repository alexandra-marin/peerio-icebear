import Keg from '../kegs/keg';
import { observable } from 'mobx';
import User from './user';

interface ISettingsPayload {
    contactNotifications: boolean;
    contactRequestNotifications: boolean;
    messageNotifications: boolean;
    errorTrackingOptIn: boolean;
    dataCollectionOptIn: boolean;
    subscribeToPromoEmails: boolean;
}
interface ISettingsProps {}
/**
 * Plaintext named system keg, server controlled.
 * User can update this keg, but server verifies contract.
 * @param  user
 */
class Settings extends Keg<ISettingsPayload, ISettingsProps> {
    constructor(user: User) {
        super('settings', 'settings', user.kegDb, true);
        this.user = user;
    }

    user: User;

    @observable contactNotifications = false;
    @observable contactRequestNotifications = false;
    @observable messageNotifications = false;
    @observable errorTracking = false;
    @observable dataCollection = false;
    @observable subscribeToPromoEmails = false;

    @observable loaded = false;

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

export default Settings;
