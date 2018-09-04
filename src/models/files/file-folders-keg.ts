import SyncedKeg from '../kegs/synced-keg';
import { IKegDb } from '~/defs/interfaces';

interface FileFoldersPayload {}

interface FileFoldersProps {}
class FileFoldersKeg extends SyncedKeg<FileFoldersPayload, FileFoldersProps> {
    constructor(db: IKegDb) {
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
