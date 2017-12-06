
const Profile = require('./profile');
const Quota = require('./quota');
const Settings = require('./settings');
const tracker = require('../update-tracker');
const { retryUntilSuccess } = require('../../helpers/retry.js');
const warnings = require('../warnings');
const socket = require('../../network/socket');
const { validators } = require('../../helpers/validation/field-validation');
const contactStore = require('../contacts/contact-store');

//
// These are still members of User class, they're just split across several mixins to make User file size sensible.
//
module.exports = function mixUserProfileModule() {
    const _profileKeg = new Profile(this);
    const _quotaKeg = new Quota(this);
    /**
     * User settings from settings keg.
     * @instance
     * @member {Settings}
     * @memberof User
     * @public
     */
    this.settings = new Settings(this);

    /**
     * @instance
     * @memberof User
     * @protected
     */
    this.loadSettings = () => {
        loadSimpleKeg(this.settings);
    };

    /**
     * @instance
     * @memberof User
     * @protected
     */
    this.saveSettings = () => {
        return this.settings.saveToServer().tapCatch(err => {
            console.error(err);
            warnings.add('error_saveSettings');
        });
    };

    /**
     * @instance
     * @memberof User
     * @protected
     */
    this.loadProfile = () => {
        loadSimpleKeg(_profileKeg);
    };

    /**
     * @instance
     * @memberof User
     * @protected
     */
    this.loadQuota = () => {
        loadSimpleKeg(_quotaKeg);
    };

    function loadSimpleKeg(keg) {
        if (keg.loading) return;
        const digest = tracker.getDigest('SELF', keg.type);
        if (keg.loaded && digest.maxUpdateId <= keg.collectionVersion) {
            if (digest.maxUpdateId !== digest.knownUpdateId) {
                tracker.seenThis('SELF', keg.type, digest.maxUpdateId);
            }
            return;
        }
        console.log(`Loading ${keg.type} keg`);
        retryUntilSuccess(() => keg.load().then(() => loadSimpleKeg(keg)), `${keg.type} Load`);
    }

    // will be triggered first time after login
    tracker.onKegTypeUpdated('SELF', 'profile', this.loadProfile);
    tracker.onKegTypeUpdated('SELF', 'quotas', this.loadQuota);
    tracker.onKegTypeUpdated('SELF', 'settings', this.loadSettings);

    /**
     * @instance
     * @memberof User
     * @protected
     */
    this.saveProfile = function() {
        return _profileKeg.saveToServer().tapCatch(err => {
            console.error(err);
            warnings.add('error_saveSettings');
        });
    };

    /**
     * @param {string} email
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.resendEmailConfirmation = function(email) {
        return socket.send('/auth/address/resend-confirmation', {
            address: {
                type: 'email',
                value: email
            }
        })
            .then(() => {
                warnings.add('warning_emailConfirmationResent');
            })
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_resendConfirmation');
            });
    };

    /**
     * @param {string} email
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.removeEmail = function(email) {
        return socket.send('/auth/address/remove', {
            address: {
                type: 'email',
                value: email
            }
        }).tapCatch(err => {
            console.error(err);
            warnings.add('error_saveSettings');
        });
    };

    /**
     * @param {string} email
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.addEmail = function(email) {
        return validators.emailAvailability.action(email).then(available => {
            if (!available) {
                warnings.addSevere('error_emailTaken', 'title_error');
                return Promise.reject(new Error(`Email ${email} already taken`));
            }
            return socket.send('/auth/address/add', {
                address: {
                    type: 'email',
                    value: email
                }
            }).then(() => {
                warnings.add('warning_emailConfirmationSent');
            }).tapCatch(err => {
                console.error(err);
                warnings.add('error_saveSettings');
            });
        });
    };

    /**
     * @param {string} email
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.makeEmailPrimary = function(email) {
        return socket.send('/auth/address/make-primary', {
            address: {
                type: 'email',
                value: email
            }
        }).tapCatch(err => {
            console.error(err);
            warnings.add('error_saveSettings');
        });
    };

    // todo: move to quota keg, make computed
    this.canSendGhost = function() {
        const q = this.quota;
        if (q && q.quotasLeft && q.quotasLeft.ghost) {
            const qTotal = q.quotasLeft.ghost.find(i => i.period === 'monthly');
            if (!qTotal) return true;
            return qTotal.limit > 0;
        }
        return true;
    };

    /**
     * @param {Array<ArrayBuffer>} [blobs] - 2 elements, 0-large, 1-medium avatar. Omit parameter
     * or pass null to delete avatar
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.saveAvatar = function(blobs) {
        if (this.savingAvatar) return Promise.reject(new Error('Already saving avatar, wait for it to finish.'));

        if (blobs) {
            if (blobs.length !== 2) return Promise.reject(new Error('Blobs array length should be 2.'));
            for (let i = 0; i < blobs.length; i++) {
                if (blobs[i] instanceof ArrayBuffer) continue;
                return Promise.reject(new Error('Blobs should be of ArrayBuffer type'));
            }
        }
        this.savingAvatar = true;
        return retryUntilSuccess(() => {
            return socket.send('/auth/avatar/update', {
                large: blobs ? blobs[0] : null,
                medium: blobs ? blobs[1] : null
            });
        }).finally(() => {
            const c = contactStore.getContact(this.username);
            c.profileVersion++;
            c.hasAvatar = !!blobs;
            this.savingAvatar = false;
        });
    };

    /**
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.deleteAvatar = function() {
        return this.saveAvatar(null);
    };

    /**
     * Notify server that the account key is backed up, so server would give a storage bonus
     * @returns {Promise}
     * @instance
     * @memberof User
     * @public
     */
    this.setAccountKeyBackedUp = function() {
        return retryUntilSuccess(() => socket.send('/auth/account-key/backed-up'));
    };
};
