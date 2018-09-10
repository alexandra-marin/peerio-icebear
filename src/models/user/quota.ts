import Keg from '../kegs/keg';
import User from '../../models/user/user';

// TODO: quota is a large and complicated object, define it later
/**
 * Plaintext readonly system named keg.
 */
class Quota extends Keg<{ quota: any }> {
    constructor(user: User) {
        super('quotas', 'quotas', user.kegDb, true);
        this.user = user;
    }
    user: User;
    deserializeKegPayload(data) {
        this.user.quota = data;
    }
}

export default Quota;
