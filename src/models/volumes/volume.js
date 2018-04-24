const { observable, when } = require('mobx');
const createMap = require('../../helpers/dynamic-array-map');
// const warnings = require('../warnings');
const AbstractFolder = require('../files/abstract-folder');
const VolumeKegDb = require('../kegs/volume-keg-db');
const ChatHead = require('../chats/chat-head');
const contactStore = require('../contacts/contact-store');
const Contact = require('../contacts/contact');
const socket = require('../../network/socket');
const warnings = require('../warnings');
const FileStoreBase = require('../files/file-store-base');

class Volume extends AbstractFolder {
    isShared = true;
    @observable id = null;

    // TODO: maybe refactor it later to use folderId instead
    get folderId() { return this.id; }
    set folderId(value) { this.id = value; }

    get name() {
        // uses AbstractFolder observable as a fallback
        return this.chatHead ? this.chatHead.chatName : this._name;
    }

    set name(value) {
        if (this.chatHead) this.rename(value);
    }

    constructor(id, name) {
        super();
        this.id = id;
        this.db = new VolumeKegDb(id);
        if (id) this.fileStore = new FileStoreBase(this.db);
        const m = createMap(this.files, 'fileId');
        // TODO: maybe we don't need that
        // it uses AbstractFolder observable
        this._name = name;
        this.fileMap = m.map;
        this.fileMapObservable = m.observableMap;
        const m2 = createMap(this.folders, 'folderId');
        this.folderMap = m2.map;
    }

    @observable loadingMeta = false;
    @observable metaLoaded = false;


    async create() {
        await this.loadMetadata();
        // TODO: remove when not needed anymore
        if (this.fileStore) throw new Error('File store for this volume is already initialized');
        this.fileStore = new FileStoreBase(this.db);
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
        if (this.metaLoaded || this.loadingMeta) return this._metaPromise;
        this.loadingMeta = true;
        this._metaPromise = this.loadMetaPromise();
        return this._metaPromise;
    }

    async loadMetaPromise() {
        await this.db.loadMeta();
        this.id = this.db.id;
        this.chatHead = new ChatHead(this.db);
        await new Promise(resolve => when(() => this.chatHead.loaded, resolve));
        this.loadingMeta = false;
        this.metaLoaded = true;
    }

    add(file) {
        if (this.fileMap[file.fileId]) {
            return;
        }
        if (file.folder) {
            console.error('file already belongs to a folder');
            return;
        }
        file.folder = this;
        file.folderId = this.isRoot ? null : this.folderId;
        this.files.push(file);
    }

    moveInto(file) {
        if (file.isFolder) {
            console.error('moving folders into shared folders is not implemented');
        } else {
            // removing from existing folder or volume
            if (file.folder) file.folder.free(file);
            this.add(file);
        }
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
    async delete() {
        // this is an ugly-ish flag to prevent chat store from creating a warning about user being kicked from channel
        this.deletedByMyself = true;
        console.log(`Deleting volume ${this.id}.`);
        try {
            await socket.send('/auth/kegs/channel/delete', { kegDbId: this.id });
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
            this.leaving = false;
        } finally {
            this.leaving = false;
        }
    }
}

module.exports = Volume;
