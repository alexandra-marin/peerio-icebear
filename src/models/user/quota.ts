import Keg from '../kegs/keg';
import User from '~/models/user/user';

/**
 * Plaintext readonly system named keg.
 */
class Quota extends Keg {
    constructor(user: User) {
        super('quotas', 'quotas', user.kegDb, true);
        this.user = user;
    }

    deserializeKegPayload(data) {
        this.user.quota = data;
    }
}

export default Quota;
