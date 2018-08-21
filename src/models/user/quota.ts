import Keg from '../kegs/keg';

/**
 * Plaintext readonly system named keg.
 * @param {User} user
 * @extends {Keg}
 */
class Quota extends Keg {
    constructor(user) {
        super('quotas', 'quotas', user.kegDb, true);
        this.user = user;
    }

    deserializeKegPayload(data) {
        this.user.quota = data;
    }
}

export default Quota;
