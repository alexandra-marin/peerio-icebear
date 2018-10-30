import { observable, computed, action, when, IObservableArray } from 'mobx';
import { setVolumeStore } from '../../helpers/di-volume-store';
import Volume from './volume';
import FileFolder from '../files/file-folder';
import Contact from '../contacts/contact';
import socket from '../../network/socket';
import warnings from '../warnings';
import dbListProvider from '../../helpers/keg-db-list-provider';
import tracker from '../update-tracker';
import TaskQueue from '../../helpers/task-queue';

export class VolumeStore {
    constructor() {
        tracker.onceUpdated(this.loadAllVolumes);
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.volumeDeleted, this.processVolumeDeletedEvent);
        });
    }

    shareQueue = new TaskQueue(1);
    @observable.shallow volumes = [] as IObservableArray<Volume>;
    readonly volumeMap: { [volumeId: string]: Volume } = {};
    @observable loading = false;
    @observable loaded = false;

    processVolumeDeletedEvent = data => {
        const volume = this.volumeMap[data.kegDbId];
        if (!volume) return;
        if (!volume.deletedByMyself) {
            warnings.addSevere('title_kickedFromVolume', '', {
                name: volume.name
            });
        }
        this.unloadVolume(volume);
    };

    @action.bound
    addVolume(volume: string | Volume): Volume {
        if (!volume) throw new Error(`Invalid volume id. ${volume}`);
        let v: Volume;
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
        v.loadMetadata().then(() => v.store.updateFiles());
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
     */
    @action.bound
    async loadAllVolumes() {
        if (this.loaded || this.loading) return;
        this.loading = true;
        await tracker.waitUntilUpdated();
        tracker.subscribeToKegDbAdded(this.addVolume);

        const volumes = await dbListProvider.getVolumes();
        volumes.forEach(this.addVolume);

        this.loading = false;
        this.loaded = true;
    }

    @action
    async createVolume(participants = [], name: string): Promise<Volume | null> {
        try {
            // 1. we can't add participants before setting volume name because
            // server will trigger invites and send empty volume name to user
            // 2. this is really a temporary instance, 'create volume and boot keg' needs to be extracted (TODO)
            let volume = new Volume(null);
            // this call will create metadata only
            await volume.db.loadMeta();
            // due to concurrency with db added event from update tracker,
            // we need to get the instance that was created from event
            // or maybe event got a bit delayed, in which case we'll receive a new Volume instance anyway
            volume = this.addVolume(volume.db.id);
            // in case instance has changed. otherwise it will immediately resolve
            await volume.loadMetadata();
            await volume.rename(name);
            await volume.store.updateFiles();
            await volume.addParticipants(participants.filter(p => !p.isMe));
            return volume;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    @action
    unloadVolume(volume: Volume) {
        volume.isDeleted = true;
        volume.dispose();
        delete this.volumeMap[volume.id];
        this.volumes.remove(volume);
    }

    getVolumeWhenReady(id: string): Promise<Volume> {
        return new Promise(resolve => {
            when(
                () => {
                    const volume = this.volumes.find(c => c.id === id);
                    return !!(volume && volume.metaLoaded);
                },
                () => resolve(this.volumeMap[id])
            );
        });
    }

    @computed
    get sortedVolumes() {
        return this.volumes.sort((f1, f2) => {
            if (f1.normalizedName > f2.normalizedName) return -1;
            if (f1.normalizedName < f2.normalizedName) return 1;
            return 0;
        });
    }

    @action.bound
    async shareFolder(folder: Volume | FileFolder, participants: (Contact | string)[]) {
        if (folder.isShared && participants) {
            return (folder as Volume).addParticipants(participants); // FIXME: automatic discrimination between Volume and FileFolder?
        }
        if (folder.store.id !== 'main') throw new Error('Can only share local folders');
        return this.shareQueue.addTask(async () => {
            const newFolder = await this.createVolume(participants, folder.name);
            folder.convertingToVolume = newFolder;
            newFolder.convertingFromFolder = folder;
            await newFolder.attach(folder, false, true);
            folder.progress = newFolder.progress = folder.progressMax = newFolder.progressMax = 0;
            folder.convertingToVolume = null;
            newFolder.convertingFromFolder = null;
            return Promise.resolve();
        });
    }
}

const volumeStore = new VolumeStore();
setVolumeStore(volumeStore);
export default volumeStore;
