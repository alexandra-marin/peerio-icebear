const { observable, reaction, action } = require('mobx');
const { TinyDb, Clock, User, warnings, clientApp } = require('peerio-icebear');
const autologin = require('~/helpers/autologin');
const appControl = require('~/helpers/app-control');

const PENDING_FILES_BANNER_KEY = 'hidePendingFilesBanner';
/**
 * This is a global UI state store. File where all things that couldn't find a place yet live.
 * Every time you add something in here - a beautiful kitten dies.
 * Every time you remove something from here - you're getting smarter.
 */
class UIStore {
    // Display NewUser page
    @observable newUserPageOpen = true;

    // If current session is user's first time using app, immediately after signup.
    @observable firstLogin = false;

    // Message object to show in sidebar when clicking on receipts
    @observable selectedMessage;

    // Controls the banner/warning about file migration deprecation and removal of pending files
    // all this will get deleted soon, as soon as migration is deprecated
    @observable pendingFilesBannerVisible = false;
    @action.bound
    hidePendingFilesBanner() {
        TinyDb.user.setValue(PENDING_FILES_BANNER_KEY, true);
        this.pendingFilesBannerVisible = false;
    }

    // show dialog about signature error
    @observable isFileSignatureErrorDialogActive = false;
    hideFileSignatureErrorDialog = () => {
        this.isFileSignatureErrorDialogActive = false;
    };
    showFileSignatureErrorDialog = () => {
        this.isFileSignatureErrorDialogActive = true;
    };

    // subscribe to this observable and it will change every minute
    minuteClock = new Clock(60);
    // message drafts, not persisted. key: chat id, value: text
    unsentMessages = {};

    // Reference to ProseMirror message input editor.
    messageInputEditorView = null;

    focusMessageInput = () => {
        if (this.messageInputEditorView) {
            this.messageInputEditorView.focus();
        }
    };

    // anything you add here will be stored with 'pref_' prefix in personal tinydb
    @observable
    prefs = {
        messageSoundsEnabled: true,
        mentionSoundsEnabled: false,
        errorSoundsEnabled: true,
        messageDesktopNotificationsEnabled: true,
        mentionDesktopNotificationsEnabled: false,
        inviteDesktopNotificationsEnabled: true,
        last2FATrustDeviceSetting: false,
        chatSideBarIsOpen: true,
        limitInlineImageSize: true, // will use config.chat.inlineImageSizeLimit
        externalContentConsented: false, // false - no feedback from user yet, true - user expressed their desire
        externalContentEnabled: false,
        externalContentJustForFavs: false,
        peerioContentConsented: false, // false - no feedback from user yet, true - user expressed their desire
        peerioContentEnabled: false,
        seenMoveToSharedVolumeWarning: false
    };

    // anything you add here will be stored with 'pref_' prefix in shared (system) tinydb
    @observable
    sharedPrefs = {
        prereleaseUpdatesEnabled: false
    };

    // initializes prefs and sharePrefs with stored data and subscribes to changes to persist them
    observePreference(key, dbName, localStore) {
        const prefKey = `pref_${key}`;
        return TinyDb[dbName].getValue(prefKey).then(loadedValue => {
            if (loadedValue || loadedValue === false) {
                localStore[key] = loadedValue;
            } else if (key === 'peerioContentEnabled') {
                // TODO: to be removed in next release after 2.108
                localStore[key] = null;
            }
            reaction(
                () => localStore[key],
                () => {
                    TinyDb[dbName].setValue(prefKey, localStore[key]);
                }
            );
        });
    }

    // should be called only once, after user has been authenticated first time
    // currently authenticated app root component calls it on mount
    async init() {
        this.pendingFilesBannerVisible = !(await TinyDb.user.getValue(
            PENDING_FILES_BANNER_KEY
        ));
        await Promise.all(
            Object.keys(this.prefs).map(key =>
                this.observePreference(key, 'user', this.prefs)
            )
        );
        await Promise.all(
            Object.keys(this.sharedPrefs).map(key =>
                this.observePreference(key, 'system', this.sharedPrefs)
            )
        );

        // TODO: to be removed
        // Due to bug and changing defaults of peerioContentEnabled
        // from true to false, if we have peerioContentEnabled undefined
        // and peerioContentConsented set to true, that means user
        // has expressed agreement to display content
        if (
            this.prefs.peerioContentEnabled === null &&
            this.prefs.peerioContentConsented
        ) {
            this.prefs.peerioContentEnabled = true;
        }

        // clear user data and relaunch when user has been deleted
        reaction(
            () => User.current.deleted,
            async deleted => {
                if (!deleted) return;
                await autologin.disable();
                // await User.current.clearFromTinyDb();
                appControl.relaunch();
            }
        );

        // warn user when blacklisted and relaunch
        reaction(
            () => User.current.blacklisted,
            blacklisted => {
                if (!blacklisted) return;
                warnings.addSevere(
                    'error_accountSuspendedText',
                    'error_accountSuspendedTitle',
                    null,
                    async () => {
                        await autologin.disable();
                        await User.current.clearFromTinyDb();
                        appControl.relaunch();
                    }
                );
            }
        );
    }
}

const store = new UIStore();
clientApp.uiUserPrefs = store.prefs;
module.exports = store;
