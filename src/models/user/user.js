const socket = require('../../network/socket');
const mixUserProfileModule = require('./user.profile.js');
const mixUserRegisterModule = require('./user.register.js');
const mixUserAuthModule = require('./user.auth.js');
const mixUser2faModule = require('./user.2fa.js');
const KegDb = require('./../kegs/keg-db');
const TinyDb = require('../../db/tiny-db');
const { observable, when, computed } = require('mobx');
const currentUserHelper = require('./../../helpers/di-current-user');
const { publicCrypto } = require('../../crypto/index');
const { formatBytes, tryToGet } = require('../../util');
const config = require('../../config');
const MRUList = require('../../helpers/mru-list');
const warnings = require('../warnings');
const clientApp = require('../client-app');

/** @type {User} */
let currentUser;

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
class User {
    _username = '';
    /**
     * @member {string} username
     */
    get username() {
        return this._username;
    }

    set username(v) {
        this._username = typeof (v) === 'string' ? v.trim().toLowerCase() : '';
    }
    // -- profile data
    /**
     * @member {string} firstName
     */
    @observable firstName = '';
    /**
     * @member {string} lastName
     */
    @observable lastName = '';
    /**
     * @member {string} email
     */
    @observable email = '';
    /**
     * @member {string} locale
     */
    @observable locale = 'en';
    /**
     * Currently unused, maybe we will bring passcodes back eventually
     * @member {boolean} passcodeIsSet
     */
    @observable passcodeIsSet = false;
    /**
     * Quota object as received from server, it has complex and weird format.
     * You don't need to use this directly, use computed properties that are based on this.
     * @member {Object} quota
     */
    @observable quota = null;
    /**
     * Sets to `true` when profile is loaded for the first time and is not empty anymore.
     * @member {boolean} profileLoaded
     */
    @observable profileLoaded = false;
    /**
     * @member {Array<Address>} addresses
     */
    @observable.ref addresses = [];
    /**
     * @member {boolean} primaryAddressConfirmed
     */
    @observable primaryAddressConfirmed = false;
    /**
     * @member {boolean} deleted
     */
    @observable deleted = false;
    /**
     * @member {boolean} blacklisted
     */
    @observable blacklisted = false;
    /**
     * Don't try to upload another avatar while this is `true`
     * @member {boolean} savingAvatar
     */
    @observable savingAvatar = false;
    /**
     * UI-controlled flag, Icebear doesn't use it
     * @member {boolean} autologinEnabled
     */
    @observable autologinEnabled = false;
    /**
     * UI-controlled flag, Icebear doesn't use it
     * @member {boolean} secureWithTouchID
     */
    @observable secureWithTouchID = false;

    /**
     * Indicates 2fa state on current user.
     * @member {boolean} twoFAEnabled
     */
    @observable twoFAEnabled = false;


    /**
     * Indicates device trust if 2fa is enabled.
     *
     * @member {boolean|undefined} trustedDevice
     */
    @observable trustedDevice = undefined;

    /**
     * Computed `firstName+' '+lastName`
     * @member {string} fullName
     */
    @computed get fullName() {
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
     * @member {number}
     */
    createdAt = null;
    // -- key data
    /**
     * @member {string}
     */
    passphrase;
    /**
     * @member {Uint8Array}
     */
    authSalt;
    /**
     * Key for SELF database boot keg.
     * @member {Uint8Array}
     */
    bootKey;
    /**
     * @member {KeyPair}
     */
    authKeys;
    /**
     * @member {KeyPair}
     */
    signKeys;
    /**
     * @member {KeyPair}
     */
    encryptionKeys;
    /**
     * Key for SELF keg database.
     * @member {Uint8Array}
     */
    kegKey;
    /**
     * Automatically managed by authentication code.
     * Session id is generated and expired by server.
     * @type {string}
     * */
    sessionId;
    // -- flags
    _firstLoginInSession = true;

    /**
     * Most recently used emoji.
     * @member {MRUList}
     */
    emojiMRU = new MRUList('emojiPicker', 30);

    constructor() {
        this.kegDb = new KegDb('SELF');
        // this is not really extending prototype, but we don't care because User is almost a singleton
        // (new instance created on every initial login attempt only)
        mixUserProfileModule.call(this);
        mixUserAuthModule.call(this);
        mixUserRegisterModule.call(this);
        mixUser2faModule.call(this);
    }

    /**
     * All current active plan names
     * @member {Array<string>} activePlans
     */
    @computed get activePlans() {
        if (this.quota == null || this.quota.quotas === null) return [];
        const { quotas } = this.quota;
        return Object.getOwnPropertyNames(quotas)
            .map(k => quotas[k].plan).filter(p => !!p);
    }

    /**
     * Total amounts of bytes user can upload.
     * @member {number} fileQuotaTotal
     */
    @computed get fileQuotaTotal() {
        if (this.quota == null || !this.quota.resultingQuotas
            || !this.quota.resultingQuotas.file || !this.quota.resultingQuotas.file.length) return 0;

        const found = this.quota.resultingQuotas.file
            .find(item => item.period === 'total' && item.metric === 'storage');

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted total amounts of bytes user can upload.
     * @member {string} fileQuotaTotalFmt
     */
    @computed get fileQuotaTotalFmt() {
        return formatBytes(this.fileQuotaTotal);
    }

    /**
     * Free bytes left for uploads.
     * @member {number} fileQuotaLeft
     */
    @computed get fileQuotaLeft() {
        if (this.quota == null || !this.quota.quotasLeft
            || !this.quota.quotasLeft.file || !this.quota.quotasLeft.file.length) return 0;

        const found = this.quota.quotasLeft.file.find(item => item.period === 'total' && item.metric === 'storage');
        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted bytes left for uploads.
     * @member {string} fileQuotaLeftFmt
     */
    @computed get fileQuotaLeftFmt() {
        return formatBytes(this.fileQuotaLeft);
    }

    /**
     * Maximum file size user can upload.
     * @member {number} fileSizeLimit
     */
    @computed get fileSizeLimit() {
        if (this.quota == null
            || !this.quota.resultingQuotas
            || !this.quota.resultingQuotas.upload
            || !this.quota.resultingQuotas.upload.length) return Number.MAX_SAFE_INTEGER;

        const found = this.quota.resultingQuotas.upload
            .find(item => item.period === 'total' && item.metric === 'maxSize');

        if (!found || found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Formatted maximum file size user can upload.
     * @member {number} fileSizeLimitFmt
     */
    @computed get fileSizeLimitFmt() {
        return formatBytes(this.fileSizeLimit);
    }

    /**
     * Used bytes in storage.
     * @member {number} fileQuotaUsed
     */
    @computed get fileQuotaUsed() {
        return this.fileQuotaTotal - this.fileQuotaLeft;
    }

    /**
     * Formatted used bytes in storage.
     * @member {number} fileQuotaUsedFmt
     */
    @computed get fileQuotaUsedFmt() {
        return formatBytes(this.fileQuotaUsed);
    }

    /**
     * Amount of % used bytes in storage.
     * @member {number} fileQuotaUsedPercent
     */
    @computed get fileQuotaUsedPercent() {
        return this.fileQuotaTotal === 0 ? 0 : Math.round(this.fileQuotaUsed / (this.fileQuotaTotal / 100));
    }

    /**
     * Maximum number of channels user can have
     * @member {number} channelLimit
     */
    @computed get channelLimit() {
        if (this.quota == null || !this.quota.resultingQuotas
            || !this.quota.resultingQuotas.channel || !this.quota.resultingQuotas.channel.length) return 0;

        const found = this.quota.resultingQuotas.channel
            .find(item => item.period === 'total' && item.metric === 'participate');

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Available channel slots left.
     * @member {number} channelsLeft
     */
    @computed get channelsLeft() {
        if (this.quota == null || !this.quota.quotasLeft
            || !this.quota.quotasLeft.channel || !this.quota.quotasLeft.channel.length) return 0;

        const found = this.quota.quotasLeft.channel
            .find(item => item.period === 'total' && item.metric === 'participate');

        if (!found) return 0;
        if (found.limit == null) return Number.MAX_SAFE_INTEGER;
        return found.limit;
    }

    /**
     * Adjust file size for overhead
     * @param {number} size - amount of bytes user wants to upload
     * @returns {number} file size including overhead
     */
    _adjustedOverheadFileSize(size) {
        const chunkSize = config.upload.getChunkSize(size);
        const chunkCount = Math.ceil(size / chunkSize);
        return (size + chunkCount * config.CHUNK_OVERHEAD);
    }

    /**
     * Maximum amount of people invited which give you bonus
     * @member {number} maxInvitedPeopleBonus
     */
    @computed get maxInvitedPeopleBonus() {
        // TODO[backlog]: this should be stored in server
        return 5;
    }

    /**
     * Maximum amount of people invited which give you bonus
     * @member {number} currentInvitedPeopleBonus
     */
    @computed get currentInvitedPeopleBonus() {
        // TODO[backlog]: this should be stored in server
        const bonusPerUser = 50 * 1024 * 1024;
        const limit = tryToGet(() => User.current.quota.quotas.userInviteOnboardingBonus.bonus.file.limit, 0);
        return Math.ceil(limit / bonusPerUser);
    }

    /**
     * Maximum bonus user can achieve if they complete all tasks
     * @member {number} maximumOnboardingBonus
     */
    @computed get maximumOnboardingBonus() {
        // TODO[backlog]: this should be stored in server
        const avatarBonus = 100;
        const emailConfirmedBonus = 100;
        const invitedUserBonus = 5 * 50;
        const roomBonus = 100;
        const backupBonus = 100;
        const installBonus = 100;
        const twoFABonus = 100;
        return avatarBonus + emailConfirmedBonus + invitedUserBonus
            + roomBonus + backupBonus + installBonus + twoFABonus;
    }

    /**
     * Maximum bonus user can achieve if they complete all tasks
     * @member {number} currentOnboardingBonus
     */
    @computed get currentOnboardingBonus() {
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
        return tryToGet(() => [
            createRoomOnboardingBonus,
            avatarOnboardingBonus,
            twofaOnboardingBonus,
            installsOnboardingBonus,
            backupOnboardingBonus,
            confirmedEmailBonus,
            userInviteOnboardingBonus
        ].reduce((sum, value) => (sum + Math.ceil(value.bonus.file.limit / 1024 / 1024)), 0), 0);
    }

    /**
     * Checks if there's enough storage to upload a file.
     * @param {number} size - amount of bytes user wants to upload.
     * @returns {boolean} is there enough storage left to upload.
     */
    canUploadFileSize = (size) => {
        return this.fileQuotaLeft >= this._adjustedOverheadFileSize(size);
    };

    /**
     * Checks if the file size is not too big for the current plan
     * e.g. Basic - 500 Mb limit, Premium - 2 Gb. Pro - unlimited.
     * @param {number} size - amount of bytes user wants to upload.
     * @returns {boolean} is file size acceptable for current plan
     */
    canUploadMaxFileSize = (size) => {
        const realSize = this._adjustedOverheadFileSize(size);
        return realSize <= this.fileSizeLimit;
    };

    @computed get hasAvatarUploadedBonus() {
        return tryToGet(() => !!this.quota.quotas.avatarOnboardingBonus.bonus.file.limit, false);
    }

    @computed get hasConfirmedEmailBonus() {
        return tryToGet(() => !!this.addresses.find(f => f.confirmed), false);
    }

    @computed get hasCreatedRoomBonus() {
        return tryToGet(() => !!this.quota.quotas.createRoomOnboardingBonus.bonus.file.limit, false);
    }

    @computed get hasInvitedFriendsBonus() {
        return tryToGet(() => !!this.quota.quotas.userInviteOnboardingBonus.bonus.file.limit, false);
    }

    @computed get hasTwoFABonus() {
        return tryToGet(() => !!this.quota.quotas.twofaOnboardingBonus.bonus.file.limit, false);
    }

    @computed get hasInstallBonus() {
        return tryToGet(() => !!this.quota.quotas.installsOnboardingBonus.bonus.file.limit, false);
    }

    @computed get hasAccountKeyBackedUpBonus() {
        return tryToGet(() => !!this.quota.quotas.backupOnboardingBonus.bonus.file.limit, false);
    }

    @computed get isPremiumUser() {
        return !!this.activePlans.filter(s => config.serverPlansPremium.includes(s)).length;
    }

    @computed get isProUser() {
        return !!this.activePlans.filter(s => config.serverPlansPro.includes(s)).length;
    }

    @computed get hasActivePlans() {
        return !!(this.activePlans && this.activePlans.length);
    }

    /**
     * Full registration process.
     * Initial login after registration differs a little.
     * @returns {Promise}
     */
    createAccountAndLogin = () => {
        console.log('Starting account registration sequence.');

        return this._createAccount()
            .then(() => this._authenticateConnection())
            .then(() => {
                console.log('Creating boot keg.');
                return this.kegDb.createBootKeg(
                    this.bootKey, this.signKeys,
                    this.encryptionKeys, this.kegKey
                );
            })
            .then(() => this._postAuth())
            .tapCatch(socket.reset);
    };

    _preAuth() {
        this.trustedDevice = undefined;
        if (this._firstLoginInSession) {
            return this._checkForPasscode();
        }
        return Promise.resolve();
    }

    /**
     * Authenticates connection and makes necessary initial requests.
     * @returns {Promise}
     */
    login = () => {
        console.log('Starting login sequence');
        return this._preAuth()
            .then(() => this._authenticateConnection())
            .then(() => this.kegDb.loadBootKeg(this.bootKey))
            .then(() => {
                this.encryptionKeys = this.kegDb.boot.encryptionKeys;
                this.signKeys = this.kegDb.boot.signKeys;
            })
            .then(() => this._postAuth())
            .catch(e => {
                if (!socket.authenticated && !clientApp.clientVersionDeprecated && !clientApp.clientSessionExpired) {
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
            when(() => this.profileLoaded, () => {
                this.setAsLastAuthenticated()
                    .catch(err => console.error(err)); // not critical, we can ignore this error
            });
        }
    }

    setReauthOnReconnect = () => {
        // only need to set reauth listener once
        if (this.stopReauthenticator) return;
        this.stopReauthenticator = socket.subscribe(socket.SOCKET_EVENTS.connect, this.login);
    };

    /**
     * Currently authenticated user.
     * @member {User}
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
     * @returns {Promise<?{username:string,firstName:string,lastName:string}>}
     */
    static getLastAuthenticated() {
        return TinyDb.system.getValue(`last_user_authenticated`);
    }

    /**
     * Saves the data of the last authenticated user.
     * @returns {Promise}
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
     * @returns {Promise}
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
     * @param {Uint8Array} theirPublicKey
     * @return {Uint8Array}
     */
    getSharedKey(theirPublicKey) {
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
        return socket.send('/auth/user/close')
            .catch(err => {
                console.error(err);
                warnings.addSevere('error_deletingAccount');
                return Promise.reject(err);
            });
    }

    clearFromTinyDb() {
        return Promise.all([
            TinyDb.user.clear(),
            User.removeLastAuthenticated()
        ]);
    }
}

module.exports = User;
