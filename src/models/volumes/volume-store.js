const { observable, computed, action, when } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
const { getChatStore } = require('../../helpers/di-chat-store');
// const cryptoUtil = require('../../crypto/util');
const Volume = require('./volume');
const folderResolveMap = require('../files/folder-resolve-map');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const contactStore = require('../contacts/contact-store');
const Contact = require('../contacts/contact');
const User = require('../user/user');
const ChatBootKeg = require('../kegs/chat-boot-keg');

function mockFolder(name) {
    const result = new Volume();
    result.name = name;
    result.folderId = `folderId${name}`;
    return result;
}

function random(max) {
    return Math.floor(Math.random() * max);
}

function mockProgress(folder) {
    if (folder.shareTimeout) return Promise.resolve();
    folder.progressMax = 100;
    folder.progress = random(10);
    folder.shareTimeout = setInterval(() => {
        folder.progress = Math.min(folder.progressMax, folder.progress + random(40));
        console.log(`progress: ${folder.progress}, ${folder.progressMax}`);
        if (folder.progress >= folder.progressMax) {
            clearInterval(folder.shareTimeout);
            folder.shareTimeout = undefined;
        }
    }, 500);
    return new Promise(resolve =>
        when(() => folder.progress === 100, () => {
            setTimeout(action(() => {
                resolve();
                folder.progress = null;
                folder.progressMax = null;
                folder.isBlocked = false;
            }), 1000);
        }));
}
/**
 * Volume store.
 * @namespace
 * @public
 */
class VolumeStore {
    constructor() {
        // socket.onceStarted(() => {
        //   socket.subscribe('volumeInvitesUpdate', this.update);
        //   socket.onAuthenticated(this.update);
        // });
    }

    @observable left = observable.shallowMap();

    /**
     * Updates local data from server.
     * @function
     * @memberof VolumeStore
     * @private
     */
    update = async () => {
        if (this.updating) {
            this.updateAgain = true;
            return;
        }
        this.updateAgain = false;
        if (!socket.authenticated) return;
        this.updating = true;

        try {
            // TODO: add this when ready
            // await this.updateInvitees();
            // await this.updateInvites();
            await this.updateLeftUsers();
        } catch (err) {
            console.error('Error updating volume store', err);
        } finally {
            this.afterUpdate();
        }
    };

    /**
     * @private
     */
    afterUpdate() {
        this.updating = false;
        if (this.updateAgain === false) return;
        setTimeout(this.update);
    }

    /** @private */
    updateLeftUsers = async () => {
        const res = await socket.send('/auth/kegs/volume/users-left');
        // TODO: make it an action?
        this.left.clear();
        for (const kegDbId in res) {
            const leavers = res[kegDbId];
            if (!leavers || !leavers.length) continue;
            this.left.set(kegDbId, leavers.map(l => { return { username: l }; }));
        }
    };

    /**
     * Remove myself from this volume.
     * @public
     */
    async leave() {
        this.leaving = true;
        try {
            await socket.send('/auth/kegs/channel/leave', { kegDbId: this.id });
        } catch (err) {
            console.error('Failed to leave channel.', this.id, err);
            warnings.add('error_channelLeave');
            this.leaving = false;
        }
    }

    /**
     * Deletes the volume.
     * @returns {Promise}
     * @public
     */
    async delete() {
        // this is an ugly-ish flag to prevent volume store from creating a warning about user being kicked from volume
        this.deletedByMyself = true;
        console.log(`Deleting volume ${this.id}.`);
        try {
            await socket.send('/auth/kegs/volume/delete', { kegDbId: this.id });
            console.log(`Volume ${this.id} has been deleted.`);
            warnings.add('title_volumeDeleted');
        } catch (err) {
            console.error('Failed to delete volume', err);
            this.deletedByMyself = false;
            warnings.add('error_volumeDelete');
            throw err;
        }
    }

    async create() {
        // the logic below takes care of rare collision cases, like when users create chat or boot keg at the same time
        await socket.send('/auth/kegs/db/create-volume')
            .then(this._parseMeta)
            .then(this._resolveBootKeg);
        /**
            id: Joi.string(),
            lastId: Joi.number().integer(),
            owner: Joi.string(),
            type: Joi.string(),
            bootVersion: Joi.number().optional(),
            permissionVersion: Joi.string().optional(),
            collectionVersions: Joi.object().pattern(/.+/, Joi.string()),
            permissions: {
                users: Joi.object().pattern(/^[a-z0-9_]{1,32}$/, Joi.string().valid('rw', 'r')),
                groups: Joi.object().optional()
            }
         */
    }

    // fills current object properties from raw keg metadata
    _parseMeta = (meta) => {
        this.id = meta.id;
        if (!this.isChannel && meta.permissions && meta.permissions.users) {
            this._metaParticipants = Object.keys(meta.permissions.users)
                .map(username => contactStore.getContactAndSave(username));
        }
    }

    // figures out if we need to load/create boot keg and does it
    _resolveBootKeg = () => {
        return this.loadBootKeg()
            .then(boot => {
                if (boot.version > 1) {
                    // disabled for now
                    // Migrating boot keg
                    if (!boot.format) {
                        boot.participants = this._metaParticipants;
                    }
                    return [boot, false];
                }
                return this.createBootKeg();
            })
            .spread((boot, justCreated) => {
                this.boot = boot;
                if (!this.key && !justCreated) this.dbIsBroken = true;
                return justCreated;
            })
            .tapCatch(err => console.error(err));
    }

    /**
     * Create boot keg for this database
     * @private
     */
    createBootKeg() {
        console.log(`Creating volume boot keg for ${this.id}`);
        const participants = this.participantsToCreateWith.slice();
        participants.push(contactStore.currentUser);
        return Contact.ensureAllLoaded(participants)
            .then(() => {
                // keg key for this db
                const boot = new ChatBootKeg(this, User.current, this.isChannel);
                boot.addKey();
                participants.forEach(p => {
                    boot.addParticipant(p);
                });
                boot.assignRole(contactStore.currentUser, 'admin');

                // saving bootkeg
                return boot.saveToServer().return([boot, true]);
            });
    }

    /**
     * MOCK METHODS/IMPLEMENTATIONS
     * TO BE REMOVED
     */
    /**
     * Full list of user's files.
     * @member {ObservableArray<File>} files
     * @memberof FileStore
     * @instance
     * @public
     */
    @observable.shallow volumes = [];

    // TODO: it is currently set on first deserialize
    // need to do something better
    rootFileFolder = undefined;

    @computed get sortedVolumes() {
        return this.volumes
            .sort((f1, f2) => f1.normalizedName > f2.normalizedName);
    }

    serialize() {
        console.log(`volume-store.js: serialization dummy`);
    }

    deserialize(parent) {
        if (this.volumes.length) return;
        this.rootFileFolder = parent;
        this.attachFolder(mockFolder('My Shared Folder 1'));
        this.attachFolder(mockFolder('My Shared Folder 2'));
        const nonOwnedOne = mockFolder('Foreign Shared Folder 3');
        nonOwnedOne.owner = 'anri';
        nonOwnedOne.isOwner = false;
        this.attachFolder(nonOwnedOne);
    }

    attachFolder(folder) {
        if (folderResolveMap.get(folder.folderId)) return;
        this.volumes.push(folder);
        folder.parent = this.rootFileFolder;
        folderResolveMap.set(folder.folderId, folder);
    }

    @action.bound async convertFolder(folder) {
        if (!folder.isShared) {
            const newFolder = mockFolder(folder.name);
            folder.isBlocked = true;
            await mockProgress(folder);
            folder.isHidden = true;
            this.attachFolder(newFolder);
        }
    }

    @action.bound async shareFolder(folder, participants) {
        await this.convertFolder(folder);
        // TODO: add participants to folder
        // TODO: maybe a better way to start the chat
        let promise = Promise.resolve();
        participants.forEach(contact => {
            promise = promise.then(async () => {
                await getChatStore().startChatAndShareFiles([contact], [folder]);
            });
        });
        await promise;
    }

    @action.bound async deleteVolume(volume) {
        // TODO: put the delete logic into the AbstractFolder (???)
        const { files } = volume;
        volume.progress = 0;
        volume.progressMax = files.length;
        volume.progressText = 'title_deletingSharedFolder';
        let promise = Promise.resolve();
        files.forEach(file => {
            promise = promise.then(async () => {
                await file.remove();
                volume.progress++;
            });
        });
        await promise;
        volume.progressMax = null;
        volume.progress = null;
        // there's a lag between deletion and file disappearance from the
        // associated folder list. so to prevent confusion we clear files here
        volume.files = [];
        const i = this.volumes.indexOf(volume);
        if (i !== -1) {
            this.volumes.splice(i, 1);
            folderResolveMap.delete(volume.folderId);
        } else {
            console.error('volume-store: cannot find the folder');
        }
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;
