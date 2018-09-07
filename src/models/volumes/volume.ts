import { observable, computed } from 'mobx';
import FileFolder from '../files/file-folder';
import VolumeKegDb from '../kegs/volume-keg-db';
import ChatHead from '../chats/chat-head';
import contactStore from '../contacts/contact-store';
import Contact from '../contacts/contact';
import socket from '../../network/socket';
import warnings from '../warnings';
import FileStoreBase from '../files/file-store-base';
import { asPromise } from '../../helpers/prombservable';
import { getFileStore } from '../../helpers/di-file-store';
import { getUser } from '../../helpers/di-current-user';
import { getChatStore } from '../../helpers/di-chat-store';

export default class Volume extends FileFolder {
    constructor(id) {
        super(null, '/', true);
        this.id = id;
        this.db = new VolumeKegDb(id);
    }

    db: VolumeKegDb;
    chatHead: ChatHead;
    _metaPromise: Promise<void>;
    deletedByMyself: boolean;
    leaving: boolean;
    // currently everyone is an admin
    canIAdmin = true;

    @observable loadingMeta = false;
    @observable metaLoaded = false;

    @observable convertingFromFolder = false;

    compareContacts = (c1, c2) => {
        return c1.fullNameAndUsername.localeCompare(c2.fullNameAndUsername);
    };

    @computed
    get allParticipants() {
        if (!this.db.boot || !this.db.boot.participants) return observable.shallow([]);
        return this.db.boot.participants.sort(this.compareContacts);
    }

    @computed
    get otherParticipants() {
        return this.allParticipants.filter(p => p.username !== getUser().username);
    }

    @computed
    get name() {
        return this.chatHead && this.chatHead.loaded ? this.chatHead.chatName : '';
    }

    set name(value) {
        if (this.chatHead) this.rename(value);
    }

    /**
     */
    rename(name) {
        let validated = name || '';
        validated = validated.trim();
        if (this.chatHead.chatName === validated) {
            return Promise.resolve(); // nothing to rename
        }
        return this.chatHead.save(
            () => {
                this.chatHead.chatName = validated;
                return true;
            },
            null,
            'error_chatRename'
        );
    }

    async loadMetadata() {
        if (this._metaPromise) return this._metaPromise;
        this.loadingMeta = true;
        this._metaPromise = this.loadMetaPromise();
        return this._metaPromise;
    }

    async loadMetaPromise() {
        await this.db.loadMeta();
        this.id = this.db.id;
        this.chatHead = new ChatHead(this.db);
        await asPromise(this.chatHead, 'loaded', true);
        if (!this.store) this.store = new FileStoreBase(this.db, this, this.id);
        this.loadingMeta = false;
        this.metaLoaded = true;
        this.mount();
    }

    async addParticipants(participants) {
        if (!participants || !participants.length) return Promise.resolve();
        const contacts = participants.map(
            p => (typeof p === 'string' ? contactStore.getContactAndSave(p) : p)
        );
        await Contact.ensureAllLoaded(contacts);

        const { boot } = this.db;
        await boot.save(
            () => {
                contacts.forEach(c => boot.addParticipant(c));
                return true;
            },
            () => {
                contacts.forEach(c => boot.removeParticipant(c));
            },
            'error_addParticipant'
        );
        warnings.add('title_addedToVolume');
        return contacts.forEach(c => getChatStore().startChatAndShareVolume(c, this));
    }

    async removeParticipant(participant) {
        let contact = participant;
        if (typeof contact === 'string') {
            // we don't really care if it's loaded or not, we just need Contact instance
            contact = contactStore.getContact(contact);
        }
        const boot = this.db.boot;
        const wasAdmin = boot.admins.includes(contact);

        await contact.ensureLoaded().then(() => {
            return boot.save(
                () => {
                    if (wasAdmin) boot.unassignRole(contact, 'admin');
                    boot.removeParticipant(contact);
                    boot.addKey();
                    return true;
                },
                () => {
                    boot.addParticipant(contact);
                    boot.removeUnsavedKey();
                    if (wasAdmin) boot.assignRole(contact, 'admin');
                },
                'error_removeParticipant'
            );
        });
        warnings.add('title_removedFromVolume');
    }

    /**
     * Deletes the volume.
     */
    async remove() {
        if (this.owner !== getUser().username) {
            this.leave();
            return;
        }
        // this is an ugly-ish flag to prevent chat store from creating a warning about user being kicked from channel
        this.deletedByMyself = true;
        console.log(`Deleting volume ${this.id}.`);
        try {
            const folderName = this.name;
            await socket.send('/auth/kegs/volume/delete', { kegDbId: this.id });
            this.isDeleted = true;

            console.log(`Volume ${this.id} has been deleted.`);
            warnings.add('warning_folderDeleted', null, { folderName });
        } catch (err) {
            console.error('Failed to delete volume', err);
            this.deletedByMyself = false;
            warnings.add('error_channelDelete');
            throw err;
        }
    }

    async leave() {
        this.leaving = true;
        try {
            await socket.send('/auth/kegs/volume/leave', { kegDbId: this.id });
        } catch (err) {
            console.error('Failed to leave volume.', this.id, err);
            warnings.add('error_volumeLeave');
        } finally {
            this.leaving = false;
        }
    }

    mount() {
        const folderStore = getFileStore().folderStore;
        if (folderStore.getById(this.id)) return;
        this.folderId = 'root';
        folderStore.folders.push(this);
    }

    unmount() {
        this.folderId = null;
        getFileStore().folderStore.folders.remove(this);
    }

    dispose() {
        this.unmount();
        this.store.dispose();
    }
}
