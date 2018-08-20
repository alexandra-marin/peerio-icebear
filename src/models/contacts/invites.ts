import SyncedKeg from '../kegs/synced-keg';
import { getUser } from '../../helpers/di-current-user';
import _ from 'lodash';

/**
 * Named readonly server-controlled keg. Contains data about contacts invited by email.
 * Invite data can be modified via separate api.
 * @extends {SyncedKeg}
 */
class Invites extends SyncedKeg {
    /**
     * @type {Array<InvitedContact>}
     */
    issued = [];
    /**
     * Usernames of users invited us before we created an account.
     * @type {Array<string>}
     */
    received = [];
    constructor() {
        super('invites', getUser().kegDb, true);
    }

    serializeKegPayload() {
        throw new Error('Read only keg is not supposed to be saved.');
    }

    deserializeKegPayload(payload) {
        this.issued = _.uniqWith(payload.issued, this._compareInvites);
        this.received = _.uniq(
            Object.keys(payload.received)
                .reduce((acc, email) => acc.concat(payload.received[email]), [])
                .map(item => item.username)
        );
    }

    _compareInvites(a, b) {
        return a.email === b.email;
    }
}

export default Invites;
