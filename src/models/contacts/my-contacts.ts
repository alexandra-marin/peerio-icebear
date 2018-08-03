import Contact from './contact';
import SyncedKeg from '../kegs/synced-keg';
import { getUser } from '../../helpers/di-current-user';

/**
 * User's favorite contacts. Named plaintext synced keg.
 */
export default class MyContacts extends SyncedKeg {
    contacts: { [contactName: string]: { addedAt: number } } = {};

    constructor() {
        super('my_contacts', getUser().kegDb, true, true);
    }

    serializeKegPayload() {
        return { contacts: this.contacts };
    }

    deserializeKegPayload(payload) {
        this.contacts = payload.contacts;
    }

    /**
     * @returns true if contact was added, false if contact was already in the list.
     */
    addContact(contact: Contact): boolean {
        if (this.contacts[contact.username]) return false;
        this.contacts[contact.username] = { addedAt: Date.now() };
        return true;
    }

    /**
     * @returns true if contact was removed, false if contact was not in the list.
     */
    removeContact(contact: Contact): boolean {
        if (!this.contacts[contact.username]) return false;
        delete this.contacts[contact.username];
        return true;
    }
}
