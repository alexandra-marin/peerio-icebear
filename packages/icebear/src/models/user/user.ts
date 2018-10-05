import socket from '../../network/socket';
import mixUserProfileModule from './user.profile.js';
import mixUserRegisterModule from './user.register.js';
import mixUserAuthModule from './user.auth.js';
import mixUser2faModule from './user.2fa.js';
import KegDb from './../kegs/keg-db';
import TinyDb from '../../db/tiny-db';
import { observable, when, computed } from 'mobx';
import * as currentUserHelper from './../../helpers/di-current-user';
import * as publicCrypto from '../../crypto/public';
import { formatBytes, tryToGet } from '../../util';
import config from '../../config';
import MRUList from '../../helpers/mru-list';
import warnings from '../warnings';
import clientApp from '../client-app';
import {
    Address,
    KeyPair,
    AuthToken,
    AccountCreationChallenge,
    AuthData
} from '../../defs/interfaces';
import AccountVersion from './account-version';
import Settings from './settings';

let currentUser: User;

/**
 * Class represents application user, you have to create and instance and assign it to `User.current`
 * on sign in. All systems depend on `User.current` to be set at the moment socket is authenticated.
 *
 * User has a lot of members and they all appear to be in the same place in documentation, but in sources
 * members are grouped by theme in several files. That said, User class and registration/authentication code
 * specifically requires refactoring to improve readability and reduce state-mutating functions amount.
 *
 * Many private and protected members are not documented with jsdoc tags to avoid clutter.
 */
export default class User {
    stopReauthenticator: () => void;
    _handleAccountCreationChallenge: (challenge: AccountCreationChallenge) => void;
    _loadAuthSalt: () => Promise<void>;
    _deriveKeys: () => Promise<void>;
    _getAuthToken: () => Promise<AuthToken>;
    _authenticateAuthToken: (data: AuthToken) => void;
    _derivePassphraseFromPasscode: (passcodeSecret: Uint8Array) => void;
    _getAuthDataFromPasscode: (passphrase: string, passcodeSecret: Uint8Array) => Promise<AuthData>;
    deserializeAuthData: (authData: AuthData) => void;
    setup2fa: () => Promise<string>;
    confirm2faSetup: (code: string, trust?: boolean) => Promise<string[]>;
    disable2fa: () => Promise<void>;
    reissueBackupCodes: () => Promise<string[]>;
    _set2faCookieData: (data: { cookie: string; trusted: boolean }) => Promise<void>;
    _get2faCookieData: () => Promise<{ cookie: string; trusted: boolean }>;
    _delete2faCookieData: () => Promise<void>;
    _getDeviceId: () => Promise<string>;
    _handle2faOnLogin: () => Promise<void>;
    _authenticateConnection: () => Promise<void>;
    _checkForPasscode: (skipCache?: boolean) => Promise<boolean>;
    serializeAuthData: () => string;
    disablePasscode: () => Promise<void>;
    passcodeIsDisabled: () => Promise<boolean>;
    setPasscode: (passcode: string) => Promise<void>;
    validatePasscode: (passcode: string) => Promise<string>;
    hasPasscode: () => Promise<boolean>;
    signout: (untrust?: boolean) => Promise<void>;
    accountVersionKeg: AccountVersion;
    settings: Settings;
    loadSettings: () => void;
    saveSettings: (updateFunction: (settingsKeg: Settings) => void) => Promise<void>;
    loadProfile: () => void;
    loadQuota: () => void;
    loadBeacons: () => void;
    saveProfile: () => Promise<void>;
    saveBeacons: () => Promise<void>;
    resendEmailConfirmation: (email: string) => Promise<void>;
    removeEmail: (email: string) => Promise<void>;
    addEmail: (email: string) => void;
    makeEmailPrimary: (email: string) => Promise<void>;
    canSendGhost: () => boolean;
    saveAvatar: (blobs?: ArrayBuffer[]) => Promise<void>;
    deleteAvatar: () => void;
    setAccountKeyBackedUp: () => Promise<void>;
    _createAccount: () => Promise<void>;

    constructor() {
        this.kegDb = new KegDb();
        // this is not really extending prototype, but we don't care because User is almost a singleton
        // (new instance created on every initial login attempt only)
        mixUserProfileModule.call(this);
        mixUserAuthModule.call(this);
        mixUserRegisterModule.call(this);
        mixUser2faModule.call(this);
    }

    kegDb: KegDb;
    _username: string = '';
    get username() {
        return this._username;
    }

    set username(v) {
        this._username = typeof v === 'string' ? v.trim().toLowerCase() : '';
    }
    // -- profile data
    @observable firstName = '';
    @observable lastName = '';
    @observable email = '';
    @observable locale = 'en';
    /**
     * Currently unused, maybe we will bring passcodes back eventually
     */
    @observable passcodeIsSet = false;
    /**
     * Quota object as received from server, it has complex and weird format.
     * You don't need to use this directly, use computed properties that are based on this.
     */
    @observable quota = null;
    /**
     * Sets to `true` when profile is loaded for the first time and is not empty anymore.
     */
    @observable profileLoaded = false;
    @observable.ref addresses: Address[] = [];
    @observable primaryAddressConfirmed = false;
    @observable deleted = false;
    @observable blacklisted = false;
    /**
     * Don't try to upload another avatar while this is `true`
     */
    @observable savingAvatar = false;
    /**
     * UI-controlled flag, Icebear doesn't use it
     */
    @observable autologinEnabled = false;
    /**
     * UI-controlled flag, Icebear doesn't use it
     */
    @observable secureWithTouchID = false;
    props: { mcrRoles?: string[] } = {};

    @computed
    get isMCAdmin() {
        if (!this.props || !this.props.mcrRoles) return null;
        return this.props.mcrRoles.some(x => x.includes('admin'));
    }

    /**
     * Indicates 2fa state on current user.
     */
    @observable twoFAEnabled = false;

    /**
     * Indicates device trust if 2fa is enabled.
     *
     */
    @observable trustedDevice: boolean;

    /**
     * UI beacons
     * @type {Map<beaconName: string, seen: bool>}
     */
    @observable beacons = observable.shallowMap<boolean>();
    /**

    /**
     * Computed `firstName+' '+lastName`
     */
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
    /**
     * Account creation timestamp. Is null until `profileLoaded != true`.
     */
    createdAt: number = null;
    // -- key data
    passphrase: string;
    authSalt: Uint8Array;
    /**
     * Key for SELF database boot keg.
     */
    bootKey: Uint8Array;
    authKeys: KeyPair;
    signKeys: KeyPair;
    encryptionKeys: KeyPair;
    /**
     * Key for SELF keg database.
     */
    kegKey: Uint8Array;
    /**
     * Automatically managed by authentication code.
     * Session id is generated and expired by server.
     * */
    sessionId: string;
    // -- flags
    _firstLoginInSession = true;

    /**
     * Most recently used emoji.
     */
    emojiMRU = new MRUList('emojiPicker', 30);

    /**
     * All current active plan names
     */
    @computed
    get activePlans() {
        if (this.quota == null || this.quota.quotas === null) return [];
        const { quotas } = this.quota;
        return Object.getOwnPropertyNames(quotas)
            .map(k => quotas[k].plan)
            .filter(p => !!p);
    }

    /**
     * Total amounts of bytes user can upload.
     */
    @computed
    get fileQuotaTotal() {
        if (
            this.quota == null ||
            !this.quota.resultingQuotas ||
            !this.quota.resultingQuotas.file ||
            !this.quota.resultingQuotas.file.length
        )
            return 0;

        const found = this.quota.resultingQuotas.file.find(
            item => item.period === 'total' && item.metric === 'storage'
        );

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted total amounts of bytes user can upload.
     */
    @computed
    get fileQuotaTotalFmt() {
        return formatBytes(this.fileQuotaTotal);
    }

    /**
     * Free bytes left for uploads.
     */
    @computed
    get fileQuotaLeft() {
        if (
            this.quota == null ||
            !this.quota.quotasLeft ||
            !this.quota.quotasLeft.file ||
            !this.quota.quotasLeft.file.length
        )
            return 0;

        const found = this.quota.quotasLeft.file.find(
            item => item.period === 'total' && item.metric === 'storage'
        );
        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted bytes left for uploads.
     */
    @computed
    get fileQuotaLeftFmt() {
        return formatBytes(this.fileQuotaLeft);
    }

    /**
     * Maximum file size user can upload.
     */
    @computed
    get fileSizeLimit() {
        if (
            this.quota == null ||
            !this.quota.resultingQuotas ||
            !this.quota.resultingQuotas.upload ||
            !this.quota.resultingQuotas.upload.length
        )
            return Number.MAX_SAFE_INTEGER;

        const found = this.quota.resultingQuotas.upload.find(
            item => item.period === 'total' && item.metric === 'maxSize'
        );

        if (!found || found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted maximum file size user can upload.
     */
    @computed
    get fileSizeLimitFmt() {
        return formatBytes(this.fileSizeLimit);
    }

    /**
     * Used bytes in storage.
     */
    @computed
    get fileQuotaUsed() {
        return this.fileQuotaTotal - this.fileQuotaLeft;
    }

    /**
     * Formatted used bytes in storage.
     */
    @computed
    get fileQuotaUsedFmt() {
        return formatBytes(this.fileQuotaUsed);
    }

    /**
     * Amount of % used bytes in storage.
     */
    @computed
    get fileQuotaUsedPercent() {
        return this.fileQuotaTotal === 0
            ? 0
            : Math.round(this.fileQuotaUsed / (this.fileQuotaTotal / 100));
    }

    /**
     * Maximum number of channels user can have
     */
    @computed
    get channelLimit() {
        if (
            this.quota == null ||
            !this.quota.resultingQuotas ||
            !this.quota.resultingQuotas.channel ||
            !this.quota.resultingQuotas.channel.length
        )
            return 0;

        const found = this.quota.resultingQuotas.channel.find(
            item => item.period === 'total' && item.metric === 'participate'
        );

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Available channel slots left.
     */
    @computed
    get channelsLeft() {
        if (
            this.quota == null ||
            !this.quota.quotasLeft ||
            !this.quota.quotasLeft.channel ||
            !this.quota.quotasLeft.channel.length
        )
            return 0;

        const found = this.quota.quotasLeft.channel.find(
            item => item.period === 'total' && item.metric === 'participate'
        );

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Adjust file size for overhead
     * @param size - amount of bytes user wants to upload
     * @returns file size including overhead
     */
    _adjustedOverheadFileSize(size: number) {
        const chunkSize = config.upload.getChunkSize(size);
        const chunkCount = Math.ceil(size / chunkSize);
        return size + chunkCount * config.CHUNK_OVERHEAD;
    }

    /**
     * Maximum amount of people invited which give you bonus
     */
    @computed
    get maxInvitedPeopleBonus() {
        // TODO[backlog]: this should be stored in server
        return 5;
    }

    /**
     * Maximum amount of people invited which give you bonus
     */
    @computed
    get currentInvitedPeopleBonus() {
        // TODO[backlog]: this should be stored in server
        const bonusPerUser = 50 * 1024 * 1024;
        const limit = tryToGet(
            () => User.current.quota.quotas.userInviteOnboardingBonus.bonus.file.limit,
            0
        );
        return Math.ceil(limit / bonusPerUser);
    }

    /**
     * Maximum bonus user can achieve if they complete all tasks
     */
    @computed
    get maximumOnboardingBonus() {
        // TODO[backlog]: this should be stored in server
        const avatarBonus = 100;
        const emailConfirmedBonus = 100;
        const invitedUserBonus = 5 * 50;
        const roomBonus = 100;
        const backupBonus = 100;
        const installBonus = 100;
        const twoFABonus = 100;
        return (
            avatarBonus +
            emailConfirmedBonus +
            invitedUserBonus +
            roomBonus +
            backupBonus +
            installBonus +
            twoFABonus
        );
    }

    /**
     * Maximum bonus user can achieve if they complete all tasks
     */
    @computed
    get currentOnboardingBonus() {
        if (!User.current.quota) return 0;
        const {
            createRoomOnboardingBonus,
            avatarOnboardingBonus,
            twofaOnboardingBonus,
            installsOnboardingBonus,
            backupOnboardingBonus,
            confirmedEmailBonus,
            userInviteOnboardingBonus
        } = User.current.quota.quotas;
        return tryToGet(
            () =>
                [
                    createRoomOnboardingBonus,
                    avatarOnboardingBonus,
                    twofaOnboardingBonus,
                    installsOnboardingBonus,
                    backupOnboardingBonus,
                    confirmedEmailBonus,
                    userInviteOnboardingBonus
                ].reduce((sum, value) => sum + Math.ceil(value.bonus.file.limit / 1024 / 1024), 0),
            0
        );
    }

    /**
     * Checks if there's enough storage to upload a file.
     * @param size - amount of bytes user wants to upload.
     * @returns is there enough storage left to upload.
     */
    canUploadFileSize = (size: number) => {
        return this.fileQuotaLeft >= this._adjustedOverheadFileSize(size);
    };

    /**
     * Checks if the file size is not too big for the current plan
     * e.g. Basic - 500 Mb limit, Premium - 2 Gb. Pro - unlimited.
     * @param size - amount of bytes user wants to upload.
     * @returns is file size acceptable for current plan
     */
    canUploadMaxFileSize = (size: number) => {
        const realSize = this._adjustedOverheadFileSize(size);
        return realSize <= this.fileSizeLimit;
    };

    @computed
    get hasAvatarUploadedBonus() {
        return tryToGet(() => !!this.quota.quotas.avatarOnboardingBonus.bonus.file.limit, false);
    }

    @computed
    get hasConfirmedEmailBonus() {
        return tryToGet(() => !!this.addresses.find(f => f.confirmed), false);
    }

    @computed
    get hasCreatedRoomBonus() {
        return tryToGet(
            () => !!this.quota.quotas.createRoomOnboardingBonus.bonus.file.limit,
            false
        );
    }

    @computed
    get hasInvitedFriendsBonus() {
        return tryToGet(
            () => !!this.quota.quotas.userInviteOnboardingBonus.bonus.file.limit,
            false
        );
    }

    @computed
    get hasTwoFABonus() {
        return tryToGet(() => !!this.quota.quotas.twofaOnboardingBonus.bonus.file.limit, false);
    }

    @computed
    get hasInstallBonus() {
        return tryToGet(() => !!this.quota.quotas.installsOnboardingBonus.bonus.file.limit, false);
    }

    @computed
    get hasAccountKeyBackedUpBonus() {
        return tryToGet(() => !!this.quota.quotas.backupOnboardingBonus.bonus.file.limit, false);
    }

    @computed
    get isPremiumUser() {
        return !!this.activePlans.filter(s => config.serverPlansPremium.includes(s)).length;
    }

    @computed
    get isProUser() {
        return !!this.activePlans.filter(s => config.serverPlansPro.includes(s)).length;
    }

    @computed
    get hasActivePlans() {
        return !!(this.activePlans && this.activePlans.length);
    }

    /**
     * Full registration process.
     * Initial login after registration differs a little.
     */
    createAccountAndLogin = () => {
        console.log('Starting account registration sequence.');

        return this._createAccount()
            .then(() => this._authenticateConnection())
            .then(() => {
                console.log('Creating boot keg.');
                return this.kegDb.createBootKeg(
                    this.bootKey,
                    this.signKeys,
                    this.encryptionKeys,
                    this.kegKey
                );
            })
            .then(() => this._postAuth())
            .tapCatch(socket.reset);
    };

    async _preAuth() {
        this.trustedDevice = undefined;
        if (this._firstLoginInSession) {
            return this._checkForPasscode();
        }
        return false;
    }

    /**
     * Authenticates connection and makes necessary initial requests.
     */
    login = () => {
        console.log('Starting login sequence');
        performance.mark('Login start');
        return this._preAuth()
            .then(() => this._authenticateConnection())
            .then(() => this.kegDb.loadBootKeg(this.bootKey))
            .then(() => {
                this.encryptionKeys = this.kegDb.boot.encryptionKeys;
                this.signKeys = this.kegDb.boot.signKeys;
            })
            .then(() => this._postAuth())
            .then(() => {
                performance.mark('Login end');
                performance.measure('Login', 'Login start', 'Login end');
            })
            .catch(e => {
                if (
                    !socket.authenticated &&
                    !clientApp.clientVersionDeprecated &&
                    !clientApp.clientSessionExpired
                ) {
                    socket.reset();
                }
                return Promise.reject(e);
            });
    };

    _postAuth() {
        socket.setAuthenticatedState();
        if (this._firstLoginInSession) {
            this._firstLoginInSession = false;
            // TODO: when we introduce key change feature - this will fail to decrypt
            TinyDb.openUser(this.username, this.kegDb.key);
            this.setReauthOnReconnect();
            this.emojiMRU.loadCache();
            // new accounts don't have digest for these kegs (they are created on first access)
            // so loading of these kegs will not get triggered automatically
            // we really need to call this here only once - after account is created, but there's no harm
            // in repeating calls every login and it's safer this way because we don't have to account
            // for failures like we would do if we called it just once at registration.
            this.loadProfile();
            this.loadQuota();
            this.loadSettings();
            when(
                () => this.profileLoaded,
                () => {
                    this.setAsLastAuthenticated().catch(err => console.error(err)); // not critical, we can ignore this error
                }
            );
        }
    }

    setReauthOnReconnect = () => {
        // only need to set reauth listener once
        if (this.stopReauthenticator) return;
        this.stopReauthenticator = socket.subscribe(socket.SOCKET_EVENTS.connect, this.login);
    };

    /**
     * Currently authenticated user.
     */
    static get current() {
        return currentUser;
    }

    static set current(val) {
        currentUser = val;
        currentUserHelper.setUser(val);
    }

    /**
     * Gets the last authenticated user.
     */
    static getLastAuthenticated(): Promise<{
        username: string;
        firstName: string;
        lastName: string;
    } | null> {
        return TinyDb.system.getValue(`last_user_authenticated`);
    }

    /**
     * Saves the data of the last authenticated user.
     */
    setAsLastAuthenticated() {
        return TinyDb.system.setValue(`last_user_authenticated`, {
            username: this.username,
            firstName: this.firstName,
            lastName: this.lastName
        });
    }

    /**
     * Removes last authenticated user information.
     */
    static removeLastAuthenticated() {
        return TinyDb.system.removeValue(`last_user_authenticated`);
    }

    // Cache for precomputed asymmetric encryption shared keys,
    // where secretKey == this.encryptionKeypair.secretKey.
    // We don't place this into crypto module to avoid shooting ourselves in the knee in numerous ways
    _sharedKeyCache = {};

    /**
     * Computes or gets from cache shared encryption key for a public key.
     */
    getSharedKey(theirPublicKey: Uint8Array) {
        if (!(theirPublicKey instanceof Uint8Array)) throw new Error('Invalid argument type');
        const cacheKey = theirPublicKey.join(',');
        let cachedValue = this._sharedKeyCache[cacheKey];
        if (cachedValue) return cachedValue;
        cachedValue = publicCrypto.computeSharedKey(theirPublicKey, this.encryptionKeys.secretKey);
        this._sharedKeyCache[cacheKey] = cachedValue;
        return cachedValue;
    }

    deleteAccount(username) {
        if (username !== this.username) {
            return Promise.reject(new Error('Pass username to delete current user account.'));
        }
        if (!this.primaryAddressConfirmed) {
            warnings.addSevere('error_deletingAccountNoConfirmedEmail');
            return Promise.reject();
        }
        return socket.send('/auth/user/close').catch(err => {
            console.error(err);
            warnings.addSevere('error_deletingAccount');
            return Promise.reject(err);
        });
    }

    clearFromTinyDb() {
        return Promise.all([TinyDb.user.clear(), User.removeLastAuthenticated()]);
    }
}
