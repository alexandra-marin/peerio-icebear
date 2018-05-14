const { observable, computed } = require('mobx');
// const createMap = require('../../helpers/dynamic-array-map');
// const warnings = require('../warnings');
const FileFolder = require('../files/file-folder');
const VolumeKegDb = require('../kegs/volume-keg-db');
const ChatHead = require('../chats/chat-head');
const contactStore = require('../contacts/contact-store');
const Contact = require('../contacts/contact');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const FileStoreBase = require('../files/file-store-base');
const { asPromise } = require('../../helpers/prombservable');
const { getFileStore } = require('../../helpers/di-file-store');
const { getUser } = require('../../helpers/di-current-user');

class Volume extends FileFolder {
    constructor(id) {
        super(null, '/', true);
        this.id = id;
        this.db = new VolumeKegDb(id);
        // if (id) this.store = new FileStoreBase(this.db, this);
    }

    // volume id
    @observable id = null;
    @observable loadingMeta = false;
    @observable metaLoaded = false;

    get folderId() { return this.id; }
    // set folderId(value) { this.id = value; }

    @computed get name() {
        // uses AbstractFolder observable as a fallback
        return this.chatHead && this.chatHead.loaded ? this.chatHead.chatName : '';
    }

    set name(value) {
        if (this.chatHead) this.rename(value);
    }

    /**
     * @public
     */
    rename(name) {
        let validated = name || '';
        validated = validated.trim();
        if (this.chatHead.chatName === validated) {
            return Promise.resolve(); // nothing to rename
        }
        return this.chatHead.save(() => {
            this.chatHead.chatName = validated;
        }, null, 'error_chatRename');
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
        if (!this.store) this.store = new FileStoreBase(this.db, this);
        this.loadingMeta = false;
        this.metaLoaded = true;
        this.mount();
    }

    async addParticipants(participants) {
        if (!participants || !participants.length) return Promise.resolve();
        const contacts = participants.map(p => (typeof p === 'string' ? contactStore.getContactAndSave(p) : p));
        await Contact.ensureAllLoaded(contacts);

        const { boot } = this.db;
        return boot.save(
            () => {
                contacts.forEach(c => boot.addParticipant(c));
                return true;
            },
            () => {
                contacts.forEach(c => boot.removeParticipant(c));
            },
            'error_addParticipant'
        );
    }

    removeParticipant(participant) {
        let contact = participant;
        if (typeof contact === 'string') {
            // we don't really care if it's loaded or not, we just need Contact instance
            contact = contactStore.getContact(contact);
        }
        const boot = this.db.boot;
        const wasAdmin = boot.admins.includes(contact);

        return contact.ensureLoaded()
            .then(() => {
                return boot.save(
                    () => {
                        if (wasAdmin) boot.unassignRole(contact, 'admin');
                        boot.removeParticipant(contact);
                        return true;
                    },
                    () => {
                        boot.addParticipant(contact);
                        if (wasAdmin) boot.assignRole(contact, 'admin');
                    },
                    'error_removeParticipant'
                );
            });
    }

    /**
     * Deletes the volume.
     * @returns {Promise}
     * @public
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
            await socket.send('/auth/kegs/channel/delete', { kegDbId: this.id });
            this.isDeleted = true;

            console.log(`Volume ${this.id} has been deleted.`);
            warnings.add('title_volumeDeleted');
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
        this.parentId = 'root';
        folderStore.folders.push(this);
    }

    unmount() {
        this.parentId = null;
        getFileStore().folderStore.folders.remove(this);
    }

    dispose() {
        this.unmount();
        this.store.dispose();
    }
}

module.exports = Volume;
