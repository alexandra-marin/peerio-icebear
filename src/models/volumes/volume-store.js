const { observable, computed, action, when } = require('mobx');
const { setVolumeStore } = require('../../helpers/di-volume-store');
const Volume = require('./volume');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const dbListProvider = require('../../helpers/keg-db-list-provider');
const tracker = require('../update-tracker');

class VolumeStore {
    constructor() {
        tracker.onceUpdated(this.loadAllVolumes);
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
            if (volume === 'SELF' || this.volumeMap[volume] || !volume.startsWith('volume:')) {
                return this.volumeMap[volume];
            }
            v = new Volume(volume);
        } else {
            v = volume;
            if (this.volumeMap[v.id]) {
                return this.volumeMap[v.id];
            }
        }

        this.volumeMap[v.id] = v;
        this.volumes.push(v);
        v.added = true;
        v.loadMetadata().then(() => v.store.loadAllFiles());
        return v;
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
        await tracker.waitUntilUpdated();
        tracker.subscribeToKegDbAdded(this.addVolume);

        const volumes = await dbListProvider.getVolumes();
        volumes.forEach(this.addVolume);

        this.loading = false;
        this.loaded = true;
    }

    @action async createVolume(participants = [], name) {
        try {
            // 1. we can't add participants before setting volume name because
            // server will trigger invites and send empty volume name to user
            // 2. this is really a temporary instance, 'create volume and boot keg' needs to be extracted (TODO)
            let volume = new Volume(null, []);
            // this call will create metadata only
            await volume.db.loadMeta();
            // due to concurrency with db added event from update tracker,
            // we need to get the instance that was created from event
            // or maybe event got a bit delayed, in which case we'll receive a new Volume instance anyway
            volume = this.addVolume(volume.db.id);
            // in case instance has changed. otherwise it will immediately resolve
            await volume.loadMetadata();
            await volume.rename(name);
            volume.store.loadAllFiles();
            volume.addParticipants(participants.filter(p => !p.isMe));
            return volume;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    @action unloadVolume(volume) {
        volume.deleted = true;
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

    @computed get sortedVolumes() {
        return this.volumes
            .sort((f1, f2) => f1.normalizedName > f2.normalizedName);
    }

    @action.bound async shareFolder(folder, participants) {
        if (folder.store.id !== 'main') return Promise.reject(new Error('Can only share local folders'));
        folder.convertingToVolume = true;
        const newFolder = await this.createVolume(participants, folder.name);
        newFolder.convertingFromFolder = true;
        await newFolder.attach(folder, false, true);
        folder.progress = newFolder.progress = folder.progressMax = newFolder.progressMax = 0;
        folder.convertingToVolume = false;
        newFolder.convertingFromFolder = false;
        return Promise.resolve();
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
module.exports = volumeStore;
