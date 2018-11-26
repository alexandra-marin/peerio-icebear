import { when } from 'mobx';
import config from '../../config';

import { ContactStore } from './contact-store';
import Contact from './contact';

// Filter contacts in Peerio namespace
// Should only return whiteLabel.name === 'peerio' contacts
// regardless of context
function peerioContactFilter(contact: Contact /* , context: string */): boolean {
    return contact.appLabel === 'peerio';
}

// Filter contacts in medcryptor workspace
// For desktop, various rules (MC only, Peerio only, or both) based on context
// For mobile always returns all users
function medcryptorContactFilter(contact: Contact, context: string): boolean {
    if (config.isMobile) return contact.appLabel === 'medcryptor';
    switch (context) {
        case 'newchat':
        case 'patientroom':
        case 'addcontact':
        case 'sharefiles':
            return contact.appLabel === 'peerio' || contact.appLabel === 'medcryptor';

        case 'newpatientspace':
            return contact.appLabel === 'peerio';

        default:
            return contact.appLabel === 'medcryptor';
    }
}

const filters = {
    peerio: peerioContactFilter,
    medcryptor: medcryptorContactFilter
};

function getContactFilter(): (contact: Contact, context?: string) => boolean {
    return filters[config.whiteLabel.name || 'peerio'];
}

export default class ContactStoreWhitelabel {
    constructor(store: ContactStore) {
        this.store = store;
    }

    store: ContactStore;

    // Filter contacts in whitelabel namespace
    // Context corresponds to part of UI where filtering is applied
    // Supported contexts = default (null or undefined), and newchat
    // For Peerio, all contexts including newchat currently return only Peerio contacts
    // For Medcryptor, newchat context returns all namespace contacts, default context
    // returns only medcryptor
    getContact(usernameOrEmail: string, context: string): Promise<Contact> {
        const c = this.store.getContact(usernameOrEmail);
        return new Promise(resolve => {
            // when our request is complete, check and apply filter
            when(
                () => !c.loading,
                () => {
                    const filter = getContactFilter();
                    if (!filter(c, context)) {
                        c.isHidden = true;
                    }
                    resolve(c);
                }
            );
        });
    }

    filter(token: string, context: string): Contact[] {
        const filter = getContactFilter();
        return this.store.filter(token).filter(c => filter(c, context));
    }

    checkMCAdmin(username: string): boolean {
        const c = this.store.getContact(username);
        if (!c || !c.mcrRoles) return null;
        return c.mcrRoles.some(x => x.includes('admin'));
    }

    checkMCDoctor(username: string): boolean {
        const c = this.store.getContact(username);
        if (!c || !c.mcrRoles) return null;
        return c.mcrRoles.includes('doctor');
    }
}
