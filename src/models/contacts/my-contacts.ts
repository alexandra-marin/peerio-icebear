import SyncedKeg from '../kegs/synced-keg';
import { getUser } from '../../helpers/di-current-user';
import Contact from './contact';
import { IKegDb } from '../../defs/interfaces';

interface MyContactsPayload {}
interface MyContactsProps {}
/**
 * User's favorite contacts. Named plaintext synced keg.
 */
class MyContacts extends SyncedKeg<MyContactsPayload, MyContactsProps> {
    constructor() {
        super('my_contacts', getUser().kegDb as IKegDb, true, true);
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
