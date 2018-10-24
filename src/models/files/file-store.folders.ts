import { observable, action, reaction, computed, IObservableArray, ObservableMap } from 'mobx';
import tracker from '../update-tracker';
import FileFolder from './file-folder';
import FileFoldersKeg from './file-folders-keg';
import createMap from '../../helpers/dynamic-array-map';
import { retryUntilSuccess } from '../../helpers/retry';
import FileStoreBase from './file-store-base';

class FileStoreFolders {
    constructor(fileStore: FileStoreBase, root: FileFolder) {
        this.fileStore = fileStore;
        this.root = root || new FileFolder(fileStore, '/');
        this.currentFolder = this.root;

        tracker.onceUpdated(() => {
            this.keg = new FileFoldersKeg(fileStore.kegDb);
            this.keg.onUpdated = () => {
                this.sync();
            };
        });
        reaction(
            () => this.currentFolder.isDeleted,
            deleted => {
                if (deleted) this.currentFolder = this.root;
            }
        );
        const map = createMap<string, FileFolder>(this.folders, 'id');
        this.foldersMap = map.observableMap;
    }

    fileStore: FileStoreBase;
    root: FileFolder;

    // flat folders array, every other folder array is computed from this one
    @observable.shallow folders = [] as IObservableArray<FileFolder>;
    // will update automatically when folders array changes
    @observable foldersMap: ObservableMap<string, FileFolder>;

    @observable loaded = false;
    @observable keg: FileFoldersKeg | null = null;

    @observable currentFolder: FileFolder;

    getById(id) {
        if (id && id.startsWith('volume:') && this.root.isShared) {
            return this.root;
        }
        return this.foldersMap.get(id);
    }

    @computed
    get selectedFolders() {
        let ret = this.folders.filter(f => f.selected);
        if (!this.fileStore.isMainStore) return ret;
        this.fileStore.getFileStoreInstances().forEach(store => {
            ret = ret.concat(store.folderStore.folders.filter(f => f.selected));
        });
        return ret;
    }

    // saves folder structure to keg
    save(): Promise<void> {
        return retryUntilSuccess(
            () =>
                this.keg.save(
                    () => {
                        this.keg.folders = this.root.folders
                            .filter(f => !f.isShared)
                            .map(f => f.serialize());
                        return true;
                    },
                    null,
                    'error_savingFileFolders'
                ),
            {
                id: `saving file folders keg for ${this.fileStore.id}`,
                maxRetries: 5
            }
        ).catch(() => this.sync());
    }

    // to avoid recursive calls of action and action nesting in result
    _syncFolder = (folderData, parentId, newTreeMap) => {
        newTreeMap[folderData.folderId] = 1; // just to mark existence
        const existing = this.foldersMap.get(folderData.folderId);
        if (existing) {
            existing.deserialize(folderData, parentId);
        } else {
            const folder = new FileFolder(this.fileStore);
            folder.deserialize(folderData, parentId);
            this.folders.push(folder);
        }
        folderData.folders.forEach(child =>
            this._syncFolder(child, folderData.folderId, newTreeMap)
        );
    };

    // reconstructs folder structure from keg data
    @action.bound
    sync() {
        // we will collect all id from keg data in here during sync
        // so we can detect removed folders afterwards
        const newTreeMap = {};
        this.keg.folders.forEach(folderData => this._syncFolder(folderData, null, newTreeMap));
        const toRemove = [];
        this.folders.forEach(folder => {
            if (!folder.isRoot && !newTreeMap[folder.id]) {
                toRemove.push(folder);
            }
        });
        toRemove.forEach(folder => {
            this.folders.remove(folder);
        });
    }
}

export default FileStoreFolders;
