const SyncedKeg = require('../kegs/synced-keg');
const { observable } = require('mobx');

class FileFoldersKeg extends SyncedKeg {
    constructor(db) {
        super('file_folders', db);
    }

    @observable.shallow folders = [];

    serializeKegPayload() {
        return {
            folders: this.folders
        };
    }

    deserializeKegPayload(payload) {
        this.folders = payload.folders;
    }
}

module.exports = FileFoldersKeg;
