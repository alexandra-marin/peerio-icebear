import socket from '../../network/socket';
import { observable, action, when, computed, reaction } from 'mobx';
import * as cryptoUtil from '../../crypto/util';
import { getUser } from './../../helpers/di-current-user';
import Tofu from './tofu';
import tofuStore from './tofu-store';
import { getFirstLetterUpperCase } from './../../helpers/string';
import serverSettings from '../server-settings';
import { t } from 'peerio-translator';
import clientApp from '../client-app';
import { getContactStore } from '../../helpers/di-contact-store';
import ContactColors from './contact.colors';

const nullFingerprint = '00000-00000-00000-00000-00000-00000';

interface LookupProfile {
    encryptionPublicKey: ArrayBuffer;
    signingPublicKey: ArrayBuffer;
    username: string;
    addresses: Array<string>;
    hasAvatar: boolean;
    appLabel: 'peerio' | 'medcryptor';
    firstName: string;
    lastName: string;
    urlSalt: string;
    isDeleted: boolean;
    props?: { mcrRoles: 'doctor' | 'admin' };
    profileVersion: number;
}

interface LookupMatch {
    matchFields: Array<'username' | 'address'>;
    profile: LookupProfile;
}
/**
 * Contact object represents any Peerio user, including currently authenticated user.
 *
 * Possible states and how to read them:
 * loading === true - trying to load contact, will make many attempts in case of connection issues
 * loading === false && notFound === false - success
 * loading === false && notFound === true  - fail
 */
class Contact {
    /**
     * @param username - this can also be an email which will be replaced with username if user found
     * @param prefetchedData - if, for some reason you have the contact data from server, feed it here
     * @param noAutoLoad - don't automatically call this.load() in constructor (needed for tests only)
     */
    constructor(username: string, prefetchedData?, noAutoLoad = false) {
        this.username = username.toLowerCase();
        if (getUser().username === this.username) this.isMe = true;
        this.usernameTag = `@${this.username}`;
        if (this.isMe) {
            this.usernameTag += ` (${t('title_you')})`;
            reaction(
                () => getUser().firstName,
                n => {
                    this.firstName = n;
                }
            );
            reaction(
                () => getUser().lastName,
                n => {
                    this.lastName = n;
                }
            );
        }
        if (!noAutoLoad) this.load(prefetchedData);
    }

    isMe = false;
    mentionRegex: RegExp;
    mcrRoles: [string];
    /**
     * This flag means that we are making attempts to load contact
     * once it's 'false' it means that we are done trying with ether positive (notFound=false) result
     * or negative result. It's set to true by default, right after it exits constructor.
     */
    @observable loading = true; // default state, because that's what we do from the moment contact is created
    username: string;
    /** '@username' */
    usernameTag: string;
    addresses: Array<string> = [];
    @observable firstName = '';
    @observable lastName = '';
    @observable encryptionPublicKey: Uint8Array = null;
    @observable signingPublicKey: Uint8Array = null;
    @observable tofuError = false;
    @observable isAdded = false;
    @observable urlSalt: string = null;
    @observable profileVersion = 0;
    @observable hasAvatar = false;
    @observable isDeleted = false;
    @observable isHidden = false;
    appLabel: 'medcryptor' | 'peerio';

    /**
     * RGB string built based on hashed signing public key, not cryptographically strong, just for better UX
     */
    @computed
    get color(): { value: string; isLight: boolean } {
        if (!this.signingPublicKey) return { value: '#e0e1e6', isLight: true };
        const int = this.signingPublicKey[0] % ContactColors.length;
        return ContactColors[int];
    }

    /**
     * First letter of first name or username.
     */
    @computed
    get letter(): string {
        return getFirstLetterUpperCase(this.firstName || this.username);
    }

    @computed
    get fullName() {
        let ret = '';
        if (this.firstName) ret = this.firstName;
        if (this.lastName) {
            if (ret) ret += ' ';
            ret += this.lastName;
        }
        return ret;
    }

    @computed
    get fullNameAndUsername() {
        let ret = '';
        if (this.firstName) ret = this.firstName;
        if (this.lastName) {
            if (ret) ret += ' ';
            ret += this.lastName;
        }
        if (ret) ret += ' ';
        ret += `(${this.username})`;
        return ret;
    }

    /**
     * Lower cased full name for search/filter optimization
     */
    @computed
    get fullNameLower() {
        return this.fullName.toLocaleLowerCase();
    }

    // fingerprint calculation is async, but at the same time we want it to be lazy computed
    // so we cache computed result here
    @observable __fingerprint: string = null;
    // but we also want to make sure computed will be refreshed on signing key change
    // so we remember which key was used
    __fingerprintKey: Uint8Array;
    /**
     * Cryptographically strong User fingerprint based on signing public key.
     * Looks like '12345-12345-12345-12345-12345', empty value is '00000-00000-00000-00000-00000-00000'
     */
    @computed
    get fingerprint(): string {
        if (!this.signingPublicKey) return nullFingerprint;
        if (!this.__fingerprint || this.__fingerprintKey !== this.signingPublicKey) {
            this.__fingerprintKey = this.signingPublicKey;
            cryptoUtil.getFingerprint(this.username, this.signingPublicKey).then(f => {
                this.__fingerprint = f;
            });

            return nullFingerprint;
        }
        return this.__fingerprint;
    }

    @computed
    get _avatarUrl() {
        return `${serverSettings.avatarServer}/v2/avatar/${this.urlSalt}`;
    }

    @computed
    get largeAvatarUrl(): string {
        if (!this.hasAvatar) return null;
        return `${this._avatarUrl}/large/?${this.profileVersion}`;
    }

    @computed
    get mediumAvatarUrl(): string {
        if (!this.hasAvatar) return null;
        // todo: returning large size here to deal with 64px upscaling to 80px on retina mess
        return `${this._avatarUrl}/large/?${this.profileVersion}`;
    }

    /**
     * Same as fingerprint, but formatted as: '1234 5123 4512\n3451 2345 1234 5123 45'
     */
    @computed
    get fingerprintSkylarFormatted() {
        let i = 0;
        return this.fingerprint
            .replace(/-/g, '')
            .match(/.{1,5}/g)
            .join(' ')
            .replace(/ /g, () => (i++ === 2 ? '\n' : ' '));
    }

    /**
     * Server said it couldn't find a user (by username or email).
     */
    @observable notFound = false;

    // to avoid parallel queries
    _waitingForResponse = false;

    static smartRequestQueue: Array<{
        username: string;
        resolve: (matches: Array<LookupMatch[]>) => void;
        reject: (err: Error) => void;
    }> = [];
    static smartRequestTimer: any = null;
    static lastTimerInterval = 0;
    static lastAdditionTime = 0;
    static smartRequestStartExecutor() {
        if (Contact.smartRequestTimer) return;
        Contact.lastTimerInterval = clientApp.updatingAfterReconnect ? 2000 : 300;
        Contact.smartRequestTimer = setInterval(
            Contact.smartRequestExecutor,
            Contact.lastTimerInterval
        );
    }

    static smartRequestExecutor() {
        if (
            Date.now() - Contact.lastAdditionTime < Contact.lastTimerInterval &&
            Contact.smartRequestQueue.length < 50
        )
            return;
        if (!Contact.smartRequestQueue.length) {
            clearInterval(Contact.smartRequestTimer);
            Contact.smartRequestTimer = null;
            return;
        }
        const queries = Contact.smartRequestQueue.splice(0, 50); // 50 - max allowed batch size on server
        console.log(`Batch requesting ${queries.length} lookups`);
        socket
            .send('/auth/user/lookup', { string: queries.map(q => q.username) }, false)
            // server returns array of matches for every search string sent, indexes of search strings
            // equal indexes of arrays of corresponding matches
            .then((res: Array<[LookupMatch]>) => {
                for (let i = 0; i < queries.length; i++) {
                    queries[i].resolve([res[i]]);
                }
            })
            .catch(err => {
                console.error(err);
                queries.forEach(q => q.reject(err));
            });
    }

    static smartRequest(username) {
        return new Promise((resolve, reject) => {
            Contact.smartRequestQueue.push({ username, resolve, reject });
            Contact.lastAdditionTime = Date.now();
            Contact.smartRequestStartExecutor();
        });
    }

    /**
     * Loads user data from server (or applies prefetched data)
     */
    load(prefetchedData?) {
        if (!this.loading || this._waitingForResponse) return;
        this.loading = true;
        this._waitingForResponse = true;

        (prefetchedData ? Promise.resolve(prefetchedData) : Contact.smartRequest(this.username))
            .then(
                action(resp => {
                    const profile = (resp && resp[0] && resp[0][0] && resp[0][0].profile) || null;
                    if (!profile) {
                        this.notFound = true;
                        this._waitingForResponse = false;
                        this.loading = false;
                        return;
                    }
                    this.username = profile.username;
                    this.usernameTag = `@${this.username}`;
                    this.appLabel = profile.appLabel || 'peerio';
                    this.firstName = profile.firstName || '';
                    this.lastName = profile.lastName || '';
                    this.urlSalt = profile.urlSalt;
                    this.hasAvatar = profile.hasAvatar;
                    this.isDeleted = !!profile.isDeleted;
                    this.addresses = profile.addresses || [];
                    this.mentionRegex = new RegExp(`@${this.username}`, 'gi');
                    this.profileVersion = profile.profileVersion || 0;
                    this.mcrRoles = profile.props ? profile.props.mcrRoles : null;

                    // this is server - controlled data, so we don't account for cases when it's invalid
                    this.encryptionPublicKey = new Uint8Array(profile.encryptionPublicKey);
                    this.signingPublicKey = new Uint8Array(profile.signingPublicKey);
                    this._waitingForResponse = false;
                    this.loading = false;
                })
            )
            .catch(err => {
                this._waitingForResponse = false;
                if (!prefetchedData) {
                    setTimeout(() => {
                        socket.onceAuthenticated(() => this.load());
                    }, 3000);
                }
                console.log(err);
            });
    }

    /**
     * Loads or creates Tofu keg and verifies Tofu data, check `tofuError` observable.
     */
    loadTofu(): Promise<void> {
        // console.log('Loading tofu:', this.username);
        return tofuStore.getByUsername(this.username).then(
            // TODO: tofu raw keg type
            action((tofu: any) => {
                this._waitingForResponse = false;
                this.loading = false;
                if (!tofu) {
                    const newTofu = new Tofu(getUser().kegDb);
                    newTofu.username = this.username;
                    newTofu.firstName = this.firstName;
                    newTofu.lastName = this.lastName;
                    newTofu.encryptionPublicKey = cryptoUtil.bytesToB64(this.encryptionPublicKey);
                    newTofu.signingPublicKey = cryptoUtil.bytesToB64(this.signingPublicKey);
                    // todo: this has a potential of creating 2+ tofu kegs for same contact
                    // todo: add checks similar to receipt keg dedupe
                    return newTofu.saveToServer();
                }
                // flagging contact
                if (
                    tofu.encryptionPublicKey !== cryptoUtil.bytesToB64(this.encryptionPublicKey) ||
                    tofu.signingPublicKey !== cryptoUtil.bytesToB64(this.signingPublicKey)
                ) {
                    this.tofuError = true;
                }
                // overriding whatever server returned for contact with our stored keys
                // so crypto operations will fail in case of difference
                // todo: this works only until we implement key change feature
                this.encryptionPublicKey = cryptoUtil.b64ToBytes(tofu.encryptionPublicKey);
                this.signingPublicKey = cryptoUtil.b64ToBytes(tofu.signingPublicKey);
                return null;
            })
        );
    }

    /**
     * Helper function to execute callback when contact is loaded.
     * Executes immediately if already loaded.
     */
    whenLoaded(callback) {
        // it is important for this to be async
        when(
            () => !this.loading && getContactStore().myContacts.loaded,
            () => setTimeout(() => callback(this))
        );
    }
    /**
     * Helper function to get a promise that resolves when contact is loaded.
     */
    ensureLoaded() {
        return new Promise(resolve => {
            this.whenLoaded(resolve);
        });
    }
    /**
     * Helper function to get a promise that resolves when all contacts in passed collection are loaded.
     */
    static ensureAllLoaded(contacts: Contact[]) {
        return Promise.map(contacts, contact => contact.ensureLoaded());
    }
}

export default Contact;
