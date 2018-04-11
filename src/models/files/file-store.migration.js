const { observable, action, when, computed } = require('mobx');
const socket = require('../../network/socket');
const User = require('../user/user');
const warnings = require('../warnings');
const { retryUntilSuccess } = require('../../helpers/retry');
const { getChatStore } = require('../../helpers/di-chat-store');
const { getContactStore } = require('../../helpers/di-contact-store');
const { asPromise } = require('../../helpers/prombservable');
const errorCodes = require('../../errors').codes;

/**
 * File store.
 * @namespace
 * @public
 */
class FileStoreMigration {
    constructor(fileStore) {
        this.fileStore = fileStore;
    }

    @observable pending = false;
    @observable started = false;
    @observable progress = 0;
    @observable performedByAnotherClient = false;
    @observable.shallow legacySharedFiles = null;

    @computed get hasLegacySharedFiles() {
        return !!(this.legacySharedFiles && this.legacySharedFiles.length);
    }

    get migrationKeg() {
        return User.current.accountVersionKeg;
    }

    async waitForStores() {
        await asPromise(this.fileStore, 'loaded', true);
        await asPromise(getChatStore(), 'loaded', true);
    }

    /**
     * Call from client to start migration.
     * Once this function stores file list, there's no reason to call it again,
     * migration will auto-start next time, if interrupted.
     */
    confirmMigration = async () => {
        if (this.started || this.migrationKeg.accountVersion === 1) return;
        this.started = true;
        await this.waitForStores();
        // in case another client has migrated while were waiting for stores
        if (this.migrationKeg.accountVersion === 1) return;

        // storing file list
        await retryUntilSuccess(() =>
            this.migrationKeg
                .save(() => {
                    this.migrationKeg.migration = { files: this.legacySharedFiles };
                })
                .catch(err => {
                    console.error(err);
                    // concurrency issue, other client managed to save first
                    if (err && err.error === errorCodes.malformedRequest) {
                        if (this.migrationKeg.accountVersion === 1) return Promise.resolve();
                        this.legacySharedFiles = this.migrationKeg.migration.files;
                        return Promise.resolve();
                    }
                    return Promise.reject(err);
                })
        );
        this.doMigrate();
    }

    async migrateToAccountVersion1() {
        if (this.migrationKeg.accountVersion === 1) return;

        this.fileStore.pause();

        if (!await this.canStartMigration()) {
            console.log('Migration is performed by another client');
            this.pending = true;
            this.performedByAnotherClient = true;
            this.started = false;
            // Handle the case when another client disconnects during migration.
            const unsubscribe = socket.subscribe(socket.APP_EVENTS.fileMigrationUnlocked, async () => {
                unsubscribe();
                console.log('Received file migration unlocked event from server');
                // Migrated?
                try {
                    await this.migrationKeg.reload();
                } catch (ex) {
                    // ignore error
                }

                this.pending = false;
                this.performedByAnotherClient = false;

                if (this.migrationKeg.accountVersion === 1) {
                    this.fileStore.resume();
                    return;
                }
                // Not migrated, try to take over the migration.
                console.log('Taking over migration');
                this.migrateToAccountVersion1();
            });
            // Handle the case when another client finishes migration.
            when(() => this.migrationKeg.accountVersion === 1, () => {
                unsubscribe();
                this.pending = false;
                this.performedByAnotherClient = false;
                this.fileStore.resume();
            });
            return;
        }

        this.pending = true;
        this.performedByAnotherClient = false;
        await retryUntilSuccess(() => this.getLegacySharedFiles());
        if (this.migrationKeg.migration.files) {
            this.legacySharedFiles = this.migrationKeg.migration.files;
            this.started = true;
            this.doMigrate();
        }
        when(() => this.migrationKeg.accountVersion === 1, this.stopMigration);
    }

    @action.bound async stopMigration() {
        await this.finishMigration();
        this.pending = false;
        this.started = false;
        this.performedByAnotherClient = false;
        this.progress = 100;
        this.fileStore.resume();
    }

    /**
     * Asks server if we can start migration.
     * @returns {Promise<boolean>}
     * @private
     */
    canStartMigration() {
        return retryUntilSuccess(() => socket.send('/auth/file/migration/start'))
            .then(res => res.success);
    }

    /**
     * Tells server that migration is finished.
     * @private
     */
    finishMigration() {
        if (this.performedByAnotherClient) return Promise.resolve();
        console.log('Sending /auth/file/migration/finish');
        return retryUntilSuccess(() => socket.send('/auth/file/migration/finish'));
    }

    async doMigrate() {
        await this.waitForStores();

        /* eslint-disable no-await-in-loop */
        for (let i = 0; i < this.legacySharedFiles.length; i++) {
            if (!this.pending) return; // it was ended externally
            this.progress = Math.floor(i / (this.legacySharedFiles.length / 100));
            const item = this.legacySharedFiles[i];
            console.log('migrating', item);
            // verify file
            const file = this.fileStore.getById(item.fileId);
            if (!file) {
                console.error(`File ${item.fileId} not found, can't migrate`);
                continue;
            }
            if (!file.format || file.migrating) {
                await asPromise(file, 'migrating', false);
            }
            if (!file.format) {
                console.error(`File ${item.fileId} is invalid, can't migrate`);
                continue;
            }
            // this will be a share in DM
            if (item.username) {
                // load and verify contact
                const contact = getContactStore().getContact(item.username);
                await contact.ensureLoaded();
                if (contact.notFound) {
                    console.error(`Contact ${item.username} not found can't share ${item.fileId}`);
                    continue;
                }
                if (contact.isDeleted) {
                    console.error(`Contact ${item.username} deleted can't share ${item.fileId}`);
                    continue;
                }
                // load and verify DM
                let chat = null;
                await retryUntilSuccess(() => {
                    chat = getChatStore().startChat([contact], false, '', '', true);
                    return chat.loadMetadata();
                }, null, 10)
                    .catch(() => {
                        console.error(`Can't create DM with ${item.username} to share ${item.fileId}`);
                    });
                if (!chat || !chat.metaLoaded) {
                    continue;
                }
                // share (retry is inside)
                await file.share(chat).catch(err => {
                    console.error(err);
                    console.error(`Failed to share ${item.fileId}`);
                });
                continue;
            } else if (item.kegDbId) {
                getChatStore().addChat(item.kegDbId, true);
                if (!getChatStore().chatMap[item.kegDbId]) {
                    console.error(`Failed to load room ${item.kegDbId}`);
                    continue;
                }
                const chat = getChatStore().chatMap[item.kegDbId];
                await chat.loadMetadata().catch(err => {
                    console.error(err);
                    console.error(`Failed to load room ${item.kegDbId}`);
                });
                if (!chat.metaLoaded) {
                    continue;
                }
                await file.share(chat).catch(err => {
                    console.error(err);
                    console.error(`Failed to share ${item.fileId}`);
                });
            }
        }
        /* eslint-enable no-await-in-loop */
        this.stopMigration();
        this.migrationKeg.save(() => {
            this.migrationKeg.migration.files = [];
            this.migrationKeg.accountVersion = 1;
        });
        warnings.add('title_fileUpdateComplete');
    }

    // [ { kegDbId: string, fileId: string }, ... ]
    getLegacySharedFiles() {
        if (this.legacySharedFiles) return Promise.resolve(this.legacySharedFiles);
        return socket.send('/auth/file/legacy/channel/list')
            .then(res => {
                this.legacySharedFiles = [];
                if (res) {
                    if (res.sharedInChannels) {
                        Object.keys(res.sharedInChannels).forEach(kegDbId => {
                            res.sharedInChannels[kegDbId].forEach(fileId => {
                                this.legacySharedFiles.push({ kegDbId, fileId });
                            });
                        });
                    }
                    if (res.sharedWithUsers) {
                        Object.keys(res.sharedWithUsers).forEach(fileId => {
                            res.sharedWithUsers[fileId].forEach(username => {
                                this.legacySharedFiles.push({ username, fileId });
                            });
                        });
                    }
                }
                return this.legacySharedFiles;
            });
    }

    async getLegacySharedFilesText() {
        await this.waitForStores();
        await this.getLegacySharedFiles();

        const eol = typeof navigator === 'undefined'
            || !navigator.platform // eslint-disable-line no-undef
            || !navigator.platform.startsWith('Win') // eslint-disable-line no-undef
            ? '\n' : '\r\n';

        let ret = '';
        for (const item of this.legacySharedFiles) {
            let fileName = item.fileId;
            const file = this.fileStore.getById(item.fileId);
            if (file && file.name) {
                fileName = file.name;
            }
            let recipient = item.username;
            if (!recipient) {
                const chat = getChatStore().chatMap[item.kegDbId];
                if (chat) {
                    await asPromise(chat, 'headLoaded', true); //eslint-disable-line
                    recipient = chat.name;
                } else {
                    recipient = item.kegDbId;
                }
            }
            ret += `${fileName} ; ${recipient}${eol}`;
        }
        return ret;
    }
}

module.exports = FileStoreMigration;
