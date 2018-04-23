const { observable, computed, action, when } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
// const cryptoUtil = require('../../crypto/util');
const Volume = require('./volume');
const folderResolveMap = require('../files/folder-resolve-map');
const socket = require('../../network/socket');
const warnings = require('../warnings');
// const contactStore = require('../contacts/contact-store');
// const Contact = require('../contacts/contact');
// const User = require('../user/user');
// const SharedDbBootKeg = require('../kegs/shared-db-boot-keg');
const { getChatStore } = require('../../helpers/di-chat-store');
const dbListProvider = require('../../helpers/keg-db-list-provider');
// const { asPromise } = require('../../helpers/prombservable');
const tracker = require('../update-tracker');


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

class VolumeStore {
    constructor() {
        socket.onceAuthenticated(this.loadAllVolumes);
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.volumeDeleted, this.processVolumeDeletedEvent);
        });
    }

    @observable.shallow volumes = [];
    volumeMap = {};
    @observable loading = false;
    @observable loaded = false;

    processVolumeDeletedEvent = data => {
        const volume = this.volumeMap[data.kegDbId];
        if (!volume) return;
        if (!volume.deletedByMyself) {
            warnings.addSevere('title_kickedFromVolume', '', { name: volume.name });
        }
        this.unloadVolume(volume);
    };

    @action.bound addVolume(volume) {
        if (!volume) throw new Error(`Invalid volume id. ${volume}`);
        let v;
        if (typeof volume === 'string') {
            if (volume === 'SELF' || this.volumeMap[volume] || !volume.startsWith('volume:')) return;
            v = new Volume(volume, undefined, this);
        } else {
            v = volume;
            if (this.volumeMap[v.id]) {
                console.error('Trying to add a copy of an instance of a volume that already exists.', v.id);
                return;
            }
        }

        this.volumeMap[v.id] = v;
        this.volumes.push(v);
        v.added = true;
        v.loadMetadata().then(() => v.fileStore.loadAllFiles());
    }


    /**
     * Initial volumes list loading, call once after login.
     *
     * Logic:
     * - load all favorite volumes
     * - see if we have some limit left and load other unhidden volumes
     * - see if digest contains some new volumes that are not hidden
     *
     * ORDER OF THE STEPS IS IMPORTANT ON MANY LEVELS
     * @function loadAllVolumes
     * @returns {Promise}
     * @memberof VolumeStore
     * @instance
     * @public
     */
    @action.bound async loadAllVolumes() {
        if (this.loaded || this.loading) return;
        this.loading = true;

        const volumes = await dbListProvider.getVolumes();
        volumes.forEach(this.addVolume);
        Object.keys(tracker.digest).forEach(this.addVolume);
        tracker.subscribeToKegDbAdded(this.addVolume);

        this.loading = false;
        this.loaded = true;
    }


    @action async createVolume(participants = [], name) {
        try {
            // we can't add participants before setting volume name because
            // server will trigger invites and send empty volume name to user
            const volume = new Volume(null, []);
            await volume.create();
            this.addVolume(volume);
            if (name) await volume.rename(name);
            volume.addParticipants(participants.filter(p => !p.isMe));
            return volume;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    @action unloadVolume(volume) {
        if (volume.active) {
            this.deactivateCurrentVolume();
        }
        volume.dispose();
        delete this.volumeMap[volume.id];
        this.volumes.remove(volume);
    }

    getVolumeWhenReady(id) {
        return new Promise((resolve) => {
            when(
                () => {
                    const volume = this.volumes.find(c => c.id === id);
                    return !!(volume && volume.metaLoaded);
                },
                () => resolve(this.volumeMap[id])
            );
        });
    }

    //------------------------------------------------------------
    /**
     * MOCK METHODS/IMPLEMENTATIONS
     * TO BE REMOVED
     */
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
        /* this.attachFolder(mockFolder('My Shared Folder 1'));
        this.attachFolder(mockFolder('My Shared Folder 2'));
        const nonOwnedOne = mockFolder('Foreign Shared Folder 3');
        nonOwnedOne.owner = 'anri';
        nonOwnedOne.isOwner = false;
        this.attachFolder(nonOwnedOne); */
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
