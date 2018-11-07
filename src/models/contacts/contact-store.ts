import {
    observable,
    when,
    action,
    computed,
    intercept,
    isObservableArray,
    IObservableArray
} from 'mobx';
import socket from '../../network/socket';
import Contact from './contact';
import { setContactStore } from '../../helpers/di-contact-store';
import MyContacts from '../contacts/my-contacts';
import Invites from '../contacts/invites';
import EventEmitter from 'eventemitter3';
import warnings from '../warnings';
import createMap from '../../helpers/dynamic-array-map';
import { getFirstLetterUpperCase } from './../../helpers/string';
import { getUser } from '../../helpers/di-current-user';
import { getChatStore } from '../../helpers/di-chat-store';
import tofuStore from './tofu-store';
import { asPromise } from '../../helpers/prombservable';
import { retryUntilSuccess } from '../../helpers/retry';
import ContactStoreWhitelabel from './contact-store.whitelabel';
import { InvitedContact } from '../../defs/interfaces';

/**
 * Contact store handles all Peerio users you(your app) are in some contact with,
 * not just the ones you add to favorites explicitly.
 */
export class ContactStore {
    constructor() {
        intercept(this, 'uiViewSortBy', this._checkSortValue);
        intercept(this, 'uiViewFilter', this._checkFilterValue);
        socket.onceAuthenticated(() => {
            this.myContacts = new MyContacts();
            this.myContacts.onUpdated = this.applyMyContactsData;
            this.invites = new Invites();
            this.invites.onUpdated = this.applyInvitesData;
            this.loadContactsFromTOFUKegs();
            this.currentUser = this.getContact(getUser().username);
        });
    }
    whitelabel = new ContactStoreWhitelabel(this);

    /**
     * All peerio users your app encounters end up here (except invited by email, they're non-peerio users).
     */
    @observable.shallow contacts = [] as IObservableArray<Contact>;
    _contactMap = createMap(this.contacts, 'username').map;
    /**
     * My contacts keg.
     */
    @observable.ref myContacts: MyContacts;
    /**
     * Invites keg.
     */
    invites: Invites;
    _requestMap = {};
    _cachedContacts = {}; // the ones that are not in this.contacts, but still valid and requested during session

    /**
     * Favorite Contacts.
     */
    @computed
    get addedContacts() {
        return this.contacts.filter(c => c.isAdded);
    }

    /**
     * Contacts pending to be added (invited manually or synced)
     */
    @observable.shallow pendingContacts = [] as IObservableArray<InvitedContact>;

    /**
     * Contacts pending to be added (invited manually or synced)
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
     */
    @observable uiViewSortBy = 'firstName';
    /**
     * options: added, all
     */
    @observable uiViewFilter = 'added';
    /**
     * Any string to search in user's names.
     * Set to `''` to clear search.
     */
    @observable uiViewSearchQuery = '';

    /**
     * Contact object instance for current user
     */
    currentUser: Contact;

    EVENT_TYPES = {
        inviteAccepted: 'inviteAccepted'
    };
    /**
     * Events emitter.
     */
    events = new EventEmitter();

    _checkSortValue(change) {
        switch (change.newValue) {
            case 'firstName':
            case 'lastName':
            case 'username':
                return change;
            default:
                console.error('Invalid contact sorting property:', change.newValue);
                return null;
        }
    }

    _checkFilterValue(change) {
        switch (change.newValue) {
            case 'added':
            case 'all':
                return change;
            default:
                console.error('Invalid contact filter property:', change.newValue);
                return null;
        }
    }

    /**
     * Helper data view to simplify sorting and filtering.
     */
    @computed
    get uiView(): Array<{ letter: string; items: Array<Contact> }> {
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

    applyMyContactsData = action(() => {
        Object.keys(this.myContacts.contacts).forEach(username => {
            this.getContactAndSave(username);
        });
        this.contacts.forEach(c => {
            c.isAdded = !!this.myContacts.contacts[c.username];
        });
    });

    applyInvitesData = action(() => {
        this.pendingContacts = observable.array(this.invites.issued, { deep: false });
        when(
            () => this.invites.loaded && tofuStore.loaded && getChatStore().loaded,
            () => {
                try {
                    this.pendingContacts.forEach(async c => {
                        if (c.username) {
                            // If c.username exists, then invited user has indeed joined Peerio & confirmed email.
                            // But, if same username isn't in tofuStore, current user doesn't yet know this,
                            // so emit `onInviteAccepted` event (on desktop this shows a notification).
                            if (!(await tofuStore.getByUsername(c.username))) {
                                setTimeout(() => this.onInviteAccepted({ contact: c }));
                            }

                            this.getContactAndSave(c.username);
                            getChatStore().pending.add(c.username, c.email, false, c.isAutoImport);
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
     * @param val - username, email or Contact
     * @returns true: added, false: not found
     */
    addContact(val: string | Contact): Promise<boolean> {
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
     */
    addContactBatch(contacts: Contact[]) {
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
     */
    importContacts(
        emails: string[]
    ): Promise<{ imported: Array<string>; notFound: Array<string> }> {
        if (!Array.isArray(emails) && !isObservableArray(emails)) {
            return Promise.reject(
                new Error(`importContact(emails) argument should be an Array<string>`)
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
                            const c = this.getContact(item[0].profile.username, [item]);
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
        return socket.send('/auth/user/lookup', { string: emails.slice(pos, pos + 15) }, false);
    }

    /**
     * Removes contact from favorites.
     */
    removeContact(usernameOrContact: string | Contact) {
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
     */
    removeInvite(email: string) {
        return retryUntilSuccess(
            () => socket.send('/auth/contacts/issued-invites/remove', { email }),
            { maxRetries: 10 }
        );
    }

    /**
     * Removes incoming invitation. This is useful for new users, logic automatically adds authors of received invites
     * to favorites and then removes received invites.
     */
    removeReceivedInvite(username: string) {
        return retryUntilSuccess(
            () =>
                socket.send('/auth/contacts/received-invites/remove', {
                    username
                }),
            { maxRetries: 10 }
        );
    }

    getContacts(usernames: string[]) {
        return usernames.map(u => this.getContact(u));
    }

    /**
     * Returns Contact object ether from cache or server.
     * It is important to be aware about `loading` state of contact, it is not guaranteed it will be loaded
     * after this function returns contact.
     */
    getContact(usernameOrEmail: string, prefetchedData?): Contact {
        const normalizedKeyword = Contact.normalizeSearchKeyword(usernameOrEmail);
        const existing =
            this._contactMap[normalizedKeyword] ||
            this._requestMap[normalizedKeyword] ||
            this._cachedContacts[normalizedKeyword];
        if (existing) return existing;

        const c = new Contact(normalizedKeyword, prefetchedData);
        // is deleted when contact is added to _contactMap only
        // see getContactAndSave
        this._requestMap[normalizedKeyword] = c;
        when(
            () => !c.loading,
            () => {
                delete this._requestMap[normalizedKeyword];
                if (c.notFound) return;
                if (this._contactMap[c.username] || this._cachedContacts[c.username]) return;
                this._cachedContacts[c.username] = c;
            }
        );
        return c;
    }

    /**
     * Searches for contact and saves its tofu,
     * effectively adding it to the contact list
     */
    getContactAndSave(usernameOrEmail: string): Contact {
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
     */
    invite(email: string, context: string, isAutoImport = false) {
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
     */
    inviteNoWarning(email: string, context: string, isAutoImport = false) {
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
     * @param token - search query string
     * @param list - optional list to search in, by default it will search in contact store
     */
    filter(token: string, list: Contact[], nosort = false) {
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
                c.username.includes(token) ||
                c.fullNameLower.includes(token) ||
                c.addresses.some(x => x.includes(token))
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
export default store;
