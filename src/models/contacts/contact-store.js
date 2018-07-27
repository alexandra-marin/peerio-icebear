const {
    observable,
    when,
    action,
    computed,
    intercept,
    isObservableArray
} = require('mobx');
const socket = require('../../network/socket');
const Contact = require('./contact');
const { setContactStore } = require('../../helpers/di-contact-store');
const MyContacts = require('../contacts/my-contacts');
const Invites = require('../contacts/invites');
const { EventEmitter } = require('eventemitter3');
const warnings = require('../warnings');
const createMap = require('../../helpers/dynamic-array-map');
const { getFirstLetterUpperCase } = require('./../../helpers/string');
const { getUser } = require('../../helpers/di-current-user');
const { getChatStore } = require('../../helpers/di-chat-store');
const tofuStore = require('./tofu-store');
const { asPromise } = require('../../helpers/prombservable');
const { retryUntilSuccess } = require('../../helpers/retry');
const ContactStoreWhitelabel = require('./contact-store.whitelabel');

/**
 * Contact store handles all Peerio users you(your app) are in some contact with,
 * not just the ones you add to favorites explicitly.
 * @namespace
 */
class ContactStore {
    /**
     * All peerio users your app encounters end up here (except invited by email, they're non-peerio users).
     * @type {ObservableArray<Contact>}
     */
    @observable.shallow contacts = [];
    /**
     * My contacts keg.
     * @type {MyContacts}
     */
    @observable.ref myContacts;
    /**
     * Invites keg.
     * @type {MyContacts}
     */
    invites;
    _requestMap = {};
    _cachedContacts = {}; // the ones that are not in this.contacts, but still valid and requested during session

    /**
     * Favorite Contacts.
     * @type {ObservableArray<Contact>}
     */
    @computed
    get addedContacts() {
        return this.contacts.filter(c => c.isAdded);
    }

    /**
     * Contacts pending to be added (invited manually or synced)
     * @type {ObservableArray<InvitedContact>}
     */
    @observable.shallow pendingContacts = [];

    /**
     * Contacts pending to be added (invited manually or synced)
     * @type {ObservableArray<InvitedContact>}
     */
    @computed
    get invitedContacts() {
        return this.pendingContacts.filter(c => !c.isAutoImport);
    }

    @computed
    get invitedNotJoinedContacts() {
        return this.invitedContacts.filter(c => !c.username);
    }

    /**
     * options: firstName, lastName, username
     * @type {string}
     */
    @observable uiViewSortBy = 'firstName';
    /**
     * options: added, all
     * @type {string}
     */
    @observable uiViewFilter = 'added';
    /**
     * Any string to search in user's names.
     * Set to `''` to clear search.
     * @type {string}
     */
    @observable uiViewSearchQuery = '';

    /**
     * Contact object instance for current user
     * @type {Contact}
     */
    currentUser;

    EVENT_TYPES = {
        inviteAccepted: 'inviteAccepted'
    };
    /**
     * Events emitter.
     * @type {EventEmitter}
     */
    events = new EventEmitter();

    _checkSortValue(change) {
        switch (change.newValue) {
            case 'firstName':
            case 'lastName':
            case 'username':
                return change;
            default:
                console.error(
                    'Invalid contact sorting property:',
                    change.newValue
                );
                return null;
        }
    }

    _checkFilterValue(change) {
        switch (change.newValue) {
            case 'added':
            case 'all':
                return change;
            default:
                console.error(
                    'Invalid contact filter property:',
                    change.newValue
                );
                return null;
        }
    }

    /**
     * Helper data view to simplify sorting and filtering.
     * @type {Array<{letter:string, items:Array<Contact>}>}
     */
    @computed
    get uiView() {
        let ret;
        switch (this.uiViewFilter) {
            case 'all':
                ret = this.contacts;
                break;
            case 'added':
                ret = this.addedContacts;
                break;
            default:
                ret = [];
        }
        if (this.uiViewSearchQuery) {
            ret = this.filter(this.uiViewSearchQuery, ret, true);
        }
        ret = ret.sort((c1, c2) => {
            const val1 = c1[this.uiViewSortBy] || '',
                val2 = c2[this.uiViewSortBy] || '';
            return val1.localeCompare(val2);
        });
        ret = this.segmentizeByFirstLetter(ret, this.uiViewSortBy);
        return ret;
    }

    segmentizeByFirstLetter(array, property) {
        const ret = [];
        if (!array.length) return ret;
        const itemsByLetter = {}; // to easily group items by letter
        const letterOrder = []; // to have the right order of letters
        for (let i = 0; i < array.length; i++) {
            const letter = getFirstLetterUpperCase(array[i][property]);
            let letterArray = itemsByLetter[letter];
            if (!letterArray) {
                letterArray = itemsByLetter[letter] = [];
                letterOrder.push(letter);
            }
            letterArray.push(array[i]);
        }
        for (let i = 0; i < letterOrder.length; i++) {
            const letter = letterOrder[i];
            ret.push({ letter, items: itemsByLetter[letter] });
        }
        return ret;
    }

    constructor() {
        intercept(this, 'uiViewSortBy', this._checkSortValue);
        intercept(this, 'uiViewFilter', this._checkFilterValue);
        this._contactMap = createMap(this.contacts, 'username').map;
        this.whitelabel = new ContactStoreWhitelabel(this);
        socket.onceAuthenticated(() => {
            this.myContacts = new MyContacts();
            this.myContacts.onUpdated = this.applyMyContactsData;
            this.invites = new Invites();
            this.invites.onUpdated = this.applyInvitesData;
            this.loadContactsFromTOFUKegs();
            this.currentUser = this.getContact(getUser().username);
        });
    }

    applyMyContactsData = action(() => {
        Object.keys(this.myContacts.contacts).forEach(username => {
            this.getContactAndSave(username);
        });
        this.contacts.forEach(c => {
            c.isAdded = !!this.myContacts.contacts[c.username];
        });
    });

    applyInvitesData = action(() => {
        this.pendingContacts = this.invites.issued;
        when(
            () =>
                this.invites.loaded &&
                tofuStore.loaded &&
                getChatStore().loaded,
            () => {
                try {
                    this.pendingContacts.forEach(async c => {
                        if (c.username) {
                            // If c.username exists, then invited user has indeed joined Peerio & confirmed email.
                            // But, if same username isn't in tofuStore, current user doesn't yet know this,
                            // so emit `onInviteAccepted` event (on desktop this shows a notification).
                            if (!(await tofuStore.getByUsername(c.username))) {
                                setTimeout(() =>
                                    this.onInviteAccepted({ contact: c })
                                );
                            }

                            this.getContactAndSave(c.username);
                            getChatStore().pending.add(
                                c.username,
                                c.email,
                                false,
                                c.isAutoImport
                            );
                        }
                        return null;
                    });
                    this.invites.received.forEach(username => {
                        this.getContactAndSave(username);
                        getChatStore().pending.add(username, null, true);
                    });
                } catch (err) {
                    console.error('Error applying contact invites', err);
                }
            }
        );
    });

    onInviteAccepted = props => {
        this.events.emit(this.EVENT_TYPES.inviteAccepted, props);
    };

    /**
     * Tries to add contact to favorites.
     * @param {string|Contact} val - username, email or Contact
     * @returns {Promise<bool>} - true: added, false: not found
     */
    addContact(val) {
        const c = typeof val === 'string' ? this.getContactAndSave(val) : val;
        return new Promise((resolve, reject) => {
            when(
                () => !c.loading,
                () => {
                    if (c.notFound) {
                        resolve(false);
                    } else {
                        // we do it here bcs it has to be as close as possible to saving my_contacts keg
                        if (this.myContacts.contacts[c.username]) {
                            resolve(true);
                            return;
                        }
                        this.myContacts
                            .save(
                                () => this.myContacts.addContact(c),
                                () => this.myContacts.removeContact(c),
                                'error_contactAddFail'
                            )
                            .then(() => {
                                // because own keg writes don't trigger digest update
                                c.isAdded = true;
                                this.applyMyContactsData();
                                resolve(true);
                            })
                            .catch(reject);
                    }
                }
            );
        });
    }

    /**
     * Accepts array of preloaded contacts, and adds them to favorites.
     * WARNING: doesn't not wait for passed contacts to load.
     * @param {Array<Contact>} contacts
     * @returns {Promise}
     */
    addContactBatch(contacts) {
        return this.myContacts.save(
            () => {
                contacts.forEach(c => this.myContacts.addContact(c));
                return true;
            },
            () => contacts.forEach(c => this.myContacts.removeContact(c))
        );
    }

    /**
     * Looks up by email and adds contacts to favorites list.
     * @param {Array<string>} emails
     * @returns {{imported:Array<string>, notFound: Array<string>}}
     */
    importContacts(emails) {
        if (!Array.isArray(emails) && !isObservableArray(emails)) {
            return Promise.reject(
                new Error(
                    `importContact(emails) argument should be an Array<string>`
                )
            );
        }
        return new Promise((resolve, reject) => {
            const ret = { imported: [], notFound: [] };
            let pos = 0;
            const step = () => {
                this._getBatchPage(emails, pos)
                    .then(res => {
                        if (!res.length) {
                            resolve(ret);
                            return null;
                        }
                        const toAdd = [];
                        for (let i = 0; i < res.length; i++) {
                            const item = res[i];
                            if (!item || !item.length) {
                                ret.notFound.push(emails[pos + i]);
                                continue;
                            }
                            const c = this.getContact(
                                item[0].profile.username,
                                [item]
                            );
                            toAdd.push(c);
                        }
                        pos += res.length;
                        return this.addContactBatch(toAdd).then(() => {
                            this.applyMyContactsData();
                            ret.imported.push(...toAdd.map(c => c.username));
                            step();
                        });
                    })
                    .catch(() => reject(ret));
            };
            step();
        });
    }

    _getBatchPage(emails, pos) {
        if (pos >= emails.length) return Promise.resolve([]);
        return socket.send(
            '/auth/user/lookup',
            { string: emails.slice(pos, pos + 15) },
            false
        );
    }

    /**
     * Removes contact from favorites.
     * @param {string|Contact} usernameOrContact
     */
    removeContact(usernameOrContact) {
        const c =
            typeof usernameOrContact === 'string'
                ? this.getContact(usernameOrContact)
                : usernameOrContact;
        if (!this.myContacts.contacts[c.username]) return Promise.resolve();
        return asPromise(c, 'loading', false).then(() => {
            if (c.notFound) {
                warnings.add('error_contactRemoveFail');
                return Promise.reject();
            }
            return this.myContacts
                .save(
                    () => this.myContacts.removeContact(c),
                    () => this.myContacts.addContact(c),
                    'error_contactRemoveFail'
                )
                .then(() => {
                    // because own keg writes don't trigger digest update
                    this.applyMyContactsData();
                });
        });
    }

    /**
     * Removes invitation.
     * @param {string} email
     * @returns {Promise}
     */
    removeInvite(email) {
        return retryUntilSuccess(
            () =>
                socket.send('/auth/contacts/issued-invites/remove', { email }),
            Math.random(),
            10
        );
    }

    /**
     * Removes incoming invitation. This is useful for new users, logic automatically adds authors of received invites
     * to favorites and then removes received invites.
     * @param {string} username
     * @returns {Promise}
     */
    removeReceivedInvite(username) {
        return retryUntilSuccess(
            () =>
                socket.send('/auth/contacts/received-invites/remove', {
                    username
                }),
            Math.random(),
            10
        );
    }

    /**
     * Returns Contact object ether from cache or server.
     * It is important to be aware about `loading` state of contact, it is not guaranteed it will be loaded
     * after this function returns contact.
     * @param {string} usernameOrEmail
     * @param {Object} [prefetchedData]
     * @returns {Contact}
     */
    getContact(usernameOrEmail, prefetchedData) {
        const existing =
            this._contactMap[usernameOrEmail] ||
            this._requestMap[usernameOrEmail] ||
            this._cachedContacts[usernameOrEmail];
        if (existing) return existing;

        const c = new Contact(usernameOrEmail, prefetchedData);
        // is deleted when contact is added to _contactMap only
        // see getContactAndSave
        this._requestMap[usernameOrEmail] = c;
        when(
            () => !c.loading,
            () => {
                delete this._requestMap[usernameOrEmail];
                if (c.notFound) return;
                if (
                    this._contactMap[c.username] ||
                    this._cachedContacts[c.username]
                )
                    return;
                this._cachedContacts[c.username] = c;
            }
        );
        return c;
    }

    /**
     * Searches for contact and saves its tofu,
     * effectively adding it to the contact list
     * @param {string} username
     */
    getContactAndSave(usernameOrEmail) {
        let c = this.getContact(usernameOrEmail);
        when(
            () => !c.loading,
            () => {
                c = this._cachedContacts[c.username] || c;
                delete this._cachedContacts[c.username];
                if (c.notFound || this._contactMap[c.username]) return;
                this.contacts.unshift(c);
                this._contactMap[c.username] = c;
                if (
                    this.myContacts &&
                    this.myContacts.loaded &&
                    this.myContacts.contacts[c.username]
                ) {
                    c.isAdded = true;
                }
                // forcing loadTofu creates a tofu keg, effectively adding the contact to contact list
                c.loadTofu();
            }
        );
        return c;
    }

    /**
     * Sends an invite
     * @param {string} email
     * @returns {Promise}
     */
    invite(email, context, isAutoImport) {
        return this.inviteNoWarning(email, context, isAutoImport)
            .then(() => {
                warnings.add('snackbar_contactInvited');
            })
            .catch(() => {
                warnings.add('error_emailInviteSend');
            });
    }

    /**
     * Sends an invite
     * @param {string} email
     * @returns {Promise}
     */
    inviteNoWarning(email, context, isAutoImport) {
        return socket.send('/auth/contacts/invite', {
            email,
            context,
            isAutoImport
        });
    }

    _merge(usernames) {
        usernames.forEach(u => this.getContactAndSave(u));
    }

    /**
     * Populates contact store with contact list from tofu kegs.
     * Any contact that your app ever encountered has a tofu keg.
     */
    loadContactsFromTOFUKegs() {
        when(
            () => tofuStore.loaded,
            async () => {
                const usernames = await tofuStore.getUsernames();
                usernames.forEach(username => this.getContactAndSave(username));
                console.log('Loaded contacts from tofu kegs');
            }
        );
    }
    /**
     * Filters contacts by username and First Last name based on passed token
     * @param {string} token - search query string
     * @param {Array<Contact>} list - optional list to search in, by default it will search in contact store
     * @returns {Array<Contact>}
     */
    filter(token, list, nosort = false) {
        // eslint-disable-next-line no-param-reassign
        token = token.toLocaleLowerCase();
        let removeUnavailable = false;
        if (!list) {
            // eslint-disable-next-line no-param-reassign
            list = this.contacts;
            removeUnavailable = true;
        }
        const ret = list.filter(c => {
            if (removeUnavailable) {
                if (c.loading || c.notFound) return false;
            }
            return (
                c.username.includes(token) || c.fullNameLower.includes(token)
            );
        });
        if (nosort) return ret;
        return ret.sort((c1, c2) => {
            if (c1.isAdded && !c2.isAdded) return -1;
            if (c2.isAdded && !c1.isAdded) return 1;
            if (token) {
                if (c1.username.startsWith(token)) return -1;
                if (c2.username.startsWith(token)) return 1;
                if (c1.fullNameLower.startsWith(token)) return -1;
                if (c2.fullNameLower.startsWith(token)) return 1;
            }
            return c1.username.localeCompare(c2.username);
        });
    }
}

const store = new ContactStore();
setContactStore(store);
module.exports = store;
