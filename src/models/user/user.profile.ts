import { when } from 'mobx';
import Profile from './profile';
import Quota from './quota';
import Settings from './settings';
import tracker from '../update-tracker';
import { retryUntilSuccess } from '../../helpers/retry';
import warnings from '../warnings';
import socket from '../../network/socket';
import validators from '../../helpers/validation/user-validators';
import contactStore from '../contacts/contact-store';
import AccountVersion from './account-version';
import { getFileStore } from '../../helpers/di-file-store';
import User from '~/models/user/user';
//
// These are still members of User class, they're just split across several mixins to make User file size sensible.
//
export default function mixUserProfileModule(this: User) {
    const _profileKeg = new Profile(this);
    const _quotaKeg = new Quota(this);
    this.accountVersionKeg = new AccountVersion(this);
    this.settings = new Settings(this);

    when(
        () => this.accountVersionKeg.loaded,
        () => {
            // already migrated?
            if (this.accountVersionKeg.accountVersion === 1) return;
            getFileStore().migration.migrateToAccountVersion1();
        }
    );

    this.loadSettings = () => {
        loadSimpleKeg(this.settings);
    };

    this.saveSettings = updateFunction => {
        const { settings } = this;
        return new Promise(resolve =>
            when(
                () => !settings.loading,
                () => {
                    if (!updateFunction)
                        throw new Error('Must provide update function to saveSettings');
                    updateFunction(settings);
                    resolve(
                        settings.saveToServer().tapCatch(err => {
                            console.error(err);
                            warnings.add('error_saveSettings');
                        })
                    );
                }
            )
        );
    };

    this.loadProfile = () => {
        loadSimpleKeg(_profileKeg);
    };

    this.loadQuota = () => {
        loadSimpleKeg(_quotaKeg);
    };

    function loadSimpleKeg(keg) {
        if (keg.loading) return;
        if (keg.loaded) {
            const digest = tracker.getDigest('SELF', keg.type);
            tracker.seenThis('SELF', keg.type, keg.collectionVersion);
            if (keg.collectionVersion >= digest.maxUpdateId) {
                return;
            }
        }
        console.log(`Loading ${keg.type} keg`);
        retryUntilSuccess(() => keg.load().then(() => loadSimpleKeg(keg)), `${keg.type} Load`);
    }

    // will be triggered first time after login
    tracker.subscribeToKegUpdates('SELF', 'profile', this.loadProfile);
    tracker.subscribeToKegUpdates('SELF', 'quotas', this.loadQuota);
    tracker.subscribeToKegUpdates('SELF', 'settings', this.loadSettings);

    tracker.onUpdated(() => {
        this.loadProfile();
        this.loadQuota();
        this.loadSettings();
    });

    this.saveProfile = function() {
        return _profileKeg.saveToServer().tapCatch(err => {
            console.error(err);
            warnings.add('error_saveSettings');
        });
    };

    this.resendEmailConfirmation = function(email: string): Promise<void> {
        return socket
            .send('/auth/address/resend-confirmation', {
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
            }) as Promise<void>;
    };

    this.removeEmail = function(email: string): Promise<void> {
        return socket
            .send('/auth/address/remove', {
                address: {
                    type: 'email',
                    value: email
                }
            })
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_saveSettings');
            }) as Promise<void>;
    };

    this.addEmail = function(email: string) {
        return validators.emailAvailability.action(email).then(available => {
            if (!available) {
                warnings.addSevere('error_emailTaken', 'title_error');
                return Promise.reject(new Error(`Email ${email} already taken`));
            }
            return socket
                .send('/auth/address/add', {
                    address: {
                        type: 'email',
                        value: email
                    }
                })
                .then(() => {
                    warnings.add('warning_emailConfirmationSent');
                })
                .tapCatch(err => {
                    console.error(err);
                    warnings.add('error_saveSettings');
                });
        });
    };

    this.makeEmailPrimary = function(email: string): Promise<void> {
        return socket
            .send('/auth/address/make-primary', {
                address: {
                    type: 'email',
                    value: email
                }
            })
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_saveSettings');
            }) as Promise<void>;
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
     *  blobs - 2 elements, 0-large, 1-medium avatar. Omit parameter
     * or pass null to delete avatar
     */
    this.saveAvatar = function(blobs?: Array<ArrayBuffer>) {
        if (this.savingAvatar)
            return Promise.reject(new Error('Already saving avatar, wait for it to finish.'));

        if (blobs) {
            if (blobs.length !== 2)
                return Promise.reject(new Error('Blobs array length should be 2.'));
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

    this.deleteAvatar = function() {
        return this.saveAvatar(null);
    };

    /**
     * Notify server that the account key is backed up, so server would give a storage bonus
     */
    this.setAccountKeyBackedUp = function() {
        return retryUntilSuccess(() => socket.send('/auth/account-key/backed-up'));
    };
}
