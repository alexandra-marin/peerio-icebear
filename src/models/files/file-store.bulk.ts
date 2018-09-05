import { action, computed } from 'mobx';
import { getChatStore } from '../../helpers/di-chat-store';
import { getFileStore } from '../../helpers/di-file-store';
import { getVolumeStore } from '../../helpers/di-volume-store';
import config from '../../config';
import warnings from '../warnings';
import FileStoreBase from '~/models/files/file-store-base';
import FileFolder from '~/models/files/file-folder';

/**
 * Extension to operate with selected files and folders in bulk
 */
class FileStoreBulk {
    constructor(fileStore: FileStoreBase) {
        this.fileStore = fileStore;
    }
    fileStore: FileStoreBase;

    // functor taking items selected as an argument to choose who to share with
    shareWithSelector = null;

    // functor taking folder as an argument to confirm folder deletion
    deleteFolderConfirmator = null;
    deleteFilesConfirmator = null;
    // functor selecting folder for bulk download
    downloadFolderSelector = null;

    pickPathSelector = null;

    @computed
    get canMove() {
        return !getFileStore().selectedFilesOrFolders.some(f => f.isFolder && f.isShared);
    }
    @computed
    get canShare() {
        return !getFileStore().selectedFilesOrFolders.some(
            f => (f.isFolder && !f.canShare) || f.isLegacy
        );
    }
    @computed
    get hasLegacyObjectsSelected() {
        return getFileStore().selectedFilesOrFolders.some(
            f => f.isLegacy || (f.isFolder && f.hasLegacyFiles)
        );
    }

    async removeOne(i, batch) {
        if (i.isFolder && this.deleteFolderConfirmator) {
            if (!(await this.deleteFolderConfirmator(i))) return Promise.reject();
        }
        return i.remove(batch);
    }

    @action.bound
    async remove() {
        const items = getFileStore().selectedFilesOrFolders;
        if (this.deleteFilesConfirmator) {
            const files = items.filter(i => !i.isFolder);
            const sharedFiles = items.filter(i => i.shared);
            if (files.length && !(await this.deleteFilesConfirmator(files, sharedFiles))) return;
        }
        let promise = Promise.resolve();
        items.forEach(i => {
            promise = promise.then(() => this.removeOne(i, true));
        });
        await promise;
        this.fileStore.folderStore.save();
        getFileStore().clearSelection();
    }

    @action.bound
    async share() {
        if (!this.shareWithSelector) {
            console.error(`shareWithSelector has not been set`);
            return;
        }
        const items = getFileStore().selectedFilesOrFolders;
        if (!items || !items.length) {
            console.log('no items selected');
            return;
        }
        const usernamesAccessList = await this.shareWithSelector();
        console.log(usernamesAccessList);
        if (!usernamesAccessList || !usernamesAccessList.length) {
            return;
        }
        let promise = Promise.resolve();
        items.forEach(i => {
            promise = promise.then(() => {
                i.selected = false;
            });
            // TODO: instanceof check is for typescript, how to avoid it?
            if (i.isFolder || i instanceof FileFolder) {
                promise = promise.then(() => getVolumeStore().shareFolder(i, usernamesAccessList));
            } else {
                usernamesAccessList.forEach(contact => {
                    promise = promise.then(async () =>
                        getChatStore().startChatAndShareFiles([contact], i)
                    );
                });
            }
        });
        await promise;
        getFileStore().clearSelection();
    }

    @action.bound
    moveOne(item, folder, bulk) {
        item.selected = false;
        if (item.folderId === folder.id) return;
        if (item.isShared) return;
        folder.attach(item);
        if (!bulk) {
            if (folder.isShared) {
                warnings.add('title_itemMovedToFolder', null, {
                    item: item.name,
                    folder: folder.name
                });
            }
            this.fileStore.folderStore.save();
        }
    }

    @action.bound
    async move(targetFolder) {
        const items = getFileStore().selectedFilesOrFolders;
        // currently progress is too quick, but in the future
        // it may make sense to show progress bar
        targetFolder.progress = 0;
        targetFolder.progressMax = items.length;
        // this is a mock to support async functions
        let promise = Promise.resolve();
        items.forEach(i => {
            promise = promise.then(async () => {
                // TODO: remove timeout
                await new Promise(resolve => setTimeout(resolve, 300));
                i.selected = false;
                if (i.folderId === targetFolder.id) return;
                if (i.isShared) return;
                targetFolder.attach(i);
                targetFolder.progress++;
            });
        });
        await promise;
        targetFolder.progress = null;
        targetFolder.progressMax = null;
        await this.fileStore.folderStore.save();
    }

    @action.bound
    async downloadOne(item, path, suppressSnackbar) {
        item.selected = false;
        const downloadPath = await this.pickPathSelector(
            path,
            item.nameWithoutExtension || item.name,
            item.ext || ''
        );
        // TODO: maybe run in parallel?
        if (item.isFolder) {
            await item.download(path, this.pickPathSelector, config.FileStream.createDir);
        } else {
            await item.download(downloadPath, false, false, suppressSnackbar);
        }
    }

    @action.bound
    async download() {
        if (!this.downloadFolderSelector) {
            console.error(`downloadFolderSelector has not been set`);
            return;
        }
        if (!this.pickPathSelector) {
            console.error(`pickPathSelector has not been set`);
            return;
        }
        const path = await this.downloadFolderSelector();
        if (!path) return;
        const items = getFileStore().selectedFilesOrFolders;
        let promise = Promise.resolve();
        items.forEach(item => {
            promise = promise.then(() => this.downloadOne(item, path, true));
        });
        await promise;
        warnings.add('snackbar_downloadsComplete');
    }
}

export default FileStoreBulk;
