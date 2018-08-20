import SyncedKeg from '../kegs/synced-keg';

class FileFoldersKeg extends SyncedKeg {
    constructor(db) {
        super('file_folders', db);
    }

    folders = [];

    serializeKegPayload() {
        return {
            folders: this.folders
        };
    }

    deserializeKegPayload(payload) {
        this.folders = payload.folders;
    }
}

export default FileFoldersKeg;
