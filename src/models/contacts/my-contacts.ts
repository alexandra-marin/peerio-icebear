import SyncedKeg from '../kegs/synced-keg';
import { getUser } from '../../helpers/di-current-user';
import Contact from '~/models/contacts/contact';

/**
 * User's favorite contacts. Named plaintext synced keg.
 * @extends {SyncedKeg}
 */
class MyContacts extends SyncedKeg {
    constructor() {
        super('my_contacts', getUser().kegDb, true, true);
    }

    contacts = {};

    serializeKegPayload() {
        return { contacts: this.contacts };
    }

    deserializeKegPayload(payload) {
        this.contacts = payload.contacts;
    }

    /**
     * @returns true - if contact was added, false - if contact was already in the list.
     */
    addContact(contact: Contact) {
        if (this.contacts[contact.username]) return false;
        this.contacts[contact.username] = { addedAt: Date.now() };
        return true;
    }

    /**
     * @returns true - if contact was removed, false - if contact was not in the list.
     */
    removeContact(contact: Contact) {
        if (!this.contacts[contact.username]) return false;
        delete this.contacts[contact.username];
        return true;
    }
}

export default MyContacts;
