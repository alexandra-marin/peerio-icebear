import Keg from '../kegs/keg';
import User from '~/models/user/user';

interface ProfilePayload {
    firstName: string;
    lastName: string;
    created?: number;
    locale: string;
    deleted?: boolean;
    primaryAddressValue?: string;
    props: {}; // todo define medcryptor props
    addresses?: Array<{ type: string; address: string }>;
    primaryAddressConfirmed?: boolean;
    isBlackListed?: boolean;
    use2fa?: boolean;
}
/**
 * Plaintext system named keg. Server verifies contract on update.
 * Some properties (addresses) can be changed only via separate api.
 */
class Profile extends Keg<ProfilePayload> {
    constructor(user: User) {
        super('profile', 'profile', user.kegDb, true);
        this.user = user;
    }

    user: User;
    serializeKegPayload() {
        return {
            firstName: this.user.firstName.trim(),
            lastName: this.user.lastName.trim(),
            locale: this.user.locale.trim(),
            props: this.user.props
        };
    }

    deserializeKegPayload(data) {
        this.user.firstName = data.firstName;
        this.user.lastName = data.lastName;
        this.user.createdAt = data.created;
        this.user.locale = data.locale;
        this.user.deleted = data.deleted;
        this.user.email = data.primaryAddressValue;
        this.user.props = data.props;
        // don't needs this currently
        // this.user.primaryAddressType = data.primaryAddressType;
        (data.addresses || []).forEach(a => {
            if (a.address === data.primaryAddressValue) a.primary = true;
        });
        // this is observable so we assign it after all modifications
        this.user.addresses = data.addresses || [];
        this.user.primaryAddressConfirmed = false;
        for (let i = 0; i < this.user.addresses.length; i++) {
            const a = this.user.addresses[i];
            if (!a.primary) continue;
            this.user.primaryAddressConfirmed = a.confirmed;
            break;
        }
        this.user.blacklisted = data.isBlackListed;
        this.user.twoFAEnabled = data.use2fa;
        this.user.profileLoaded = true;
    }
}

export default Profile;
