const { when, action } = require('mobx');
const Contact = require('./contact');
const config = require('../../config');

// Filter contacts in Peerio namespace
// Should only return whiteLabel.name === 'peerio' contacts
// regardless of context
function peerioContactFilter(contact /* , context */) {
    return contact.appLabel === 'peerio';
}

// Filter contacts in medcryptor workspace
// Should return only medcryptor contacts in default context (null)
// and Peerio and MedCryptor contacts in "newchat" context
function medcryptorContactFilter(contact, context) {
    switch (context) {
        case 'newchat': return true;
        default: return contact.appLabel === 'medcryptor';
    }
}

const filters = {
    peerio: peerioContactFilter,
    medcryptor: medcryptorContactFilter
};

class ContactStoreWhitelabel {
    // ref to contactStore
    store = null;

    constructor(store) {
        this.store = store;
    }

    // Filter contacts in whitelabel namespace
    // Context corresponds to part of UI where filtering is applied
    // Supported contexts = default (null or undefined), and newchat
    // For Peerio, all contexts including newchat currently return only Peerio contacts
    // For Medcryptor, newchat context returns all namespace contacts, default context
    // returns only medcryptor
    getContact(usernameOrEmail, context) {
        const result = new Contact(usernameOrEmail, null, true);
        const c = this.store.getContact(usernameOrEmail);
        // when our request is complete, check and apply filter
        when(() => !c.loading, action(() => {
            const filter = filters[config.whiteLabel.name || 'peerio'];
            if (filter(c, context)) {
                Object.assign(result, c);
            } else {
                result.notFound = true;
            }
            result.loading = false;
        }));
        return result;
    }
}

module.exports = ContactStoreWhitelabel;
