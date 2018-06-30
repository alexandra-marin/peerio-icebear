const { when } = require('mobx');
const config = require('../../config');

// Filter contacts in Peerio namespace
// Should only return whiteLabel.name === 'peerio' contacts
// regardless of context
function peerioContactFilter(contact /* , context */) {
    return contact.appLabel === 'peerio';
}

// Filter contacts in medcryptor workspace
// For desktop, various rules (MC only, Peerio only, or both) based on context
// For mobile always returns all users
function medcryptorContactFilter(contact, context) {
    if (config.isMobile) return true;
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

function getContactFilter() {
    return filters[config.whiteLabel.name || 'peerio'];
}

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
        const c = this.store.getContact(usernameOrEmail);
        return new Promise(resolve => {
            // when our request is complete, check and apply filter
            when(() => !c.loading, () => {
                const filter = getContactFilter();
                if (!filter(c, context)) {
                    c.isHidden = true;
                }
                resolve(c);
            });
        });
    }

    filter(token, context) {
        const filter = getContactFilter();
        return this.store.filter(token).filter(c => filter(c, context));
    }

    checkMCAdmin(username) {
        const c = this.getContact(username);
        if (!c || !c.props.mcrRoles) return null;
        return c.props.mcrRoles.some(x => x.includes('admin'));
    }

    checkMCDoctor(username) {
        const c = this.getContact(username);
        if (!c || !c.props.mcrRoles) return null;
        return c.props.mcrRoles.includes('doctor');
    }
}

module.exports = ContactStoreWhitelabel;
