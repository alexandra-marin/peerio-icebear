const { action, computed } = require('mobx');
const { getChatStore } = require('../../helpers/di-chat-store');
const volumeStore = require('../volumes/volume-store');
const config = require('../../config');

/**
 * Extension to operate with selected files and folders in bulk
 */
class FileStoreBulk {
    // functor taking items selected as an argument to choose who to share with
    shareWithSelector = null;

    // functor taking folder as an argument to confirm folder deletion
    deleteFolderConfirmator = null;

    // functor taking files and shared fiels as an argument to confirm
    // folder deletion
    deleteFolderConfirmator = null;

    // functor selecting folder for bulk download
    downloadFolderSelector = null;

    constructor(fileStore) {
        this.fileStore = fileStore;
    }

    @computed get canMove() {
        return !this.fileStore.selectedFilesOrFolders.some(f => f.isFolder && f.isShared);
    }

    async removeOne(i, batch) {
        if (i.isFolder && this.deleteFolderConfirmator) {
            if (!await this.deleteFolderConfirmator(i)) return;
        }
        if (i.isFolder && !i.isShared) {
            await this.fileStore.folders.deleteFolder(i);
            if (!batch) this.fileStore.folders.save();
        } else if (i.isFolder) {
            await volumeStore.deleteVolume(i);
        } else {
            await i.remove();
        }
    }

    @action.bound async remove() {
        const items = this.fileStore.selectedFilesOrFolders;
        if (this.deleteFilesConfirmator) {
            const files = items.filter(i => !i.isFolder);
            const sharedFiles = items.filter(i => i.shared);
            if (files.length && !await this.deleteFilesConfirmator(files, sharedFiles)) return;
        }
        let promise = Promise.resolve();
        items.forEach(i => {
            promise = promise.then(() => this.removeOne(i, true));
        });
        await promise;
        this.fileStore.folders.save();
        this.fileStore.clearSelection();
    }

    @action.bound async share() {
        if (!this.shareWithSelector) {
            console.error(`shareWithSelector has not been set`);
            return;
        }
        const items = this.fileStore.selectedFilesOrFolders;
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
            let operation = Promise.resolve();
            promise = promise.then(() => { i.selected = false; });
            if (i.isFolder) {
                operation = () => this.fileStore.folders.shareFolder(i, usernamesAccessList);
            } else {
                operation = () => getChatStore().startChatAndShareFiles(usernamesAccessList, [i]);
            }
            promise = promise.then(operation);
        });
        await promise;
        this.fileStore.clearSelection();
    }

    @action.bound move(targetFolder) {
        const items = this.fileStore.selectedFilesOrFolders;
        items.forEach(i => {
            i.selected = false;
            if (i.folderId === targetFolder.folderId) return;
            if (i.isShared) return;
            targetFolder.moveInto(i);
        });
        return this.fileStore.folders.save();
    }

    @action.bound async downloadOne(item, path) {
        item.selected = false;
        const downloadPath = await this.pickPathSelector(
            path,
            item.nameWithoutExtension || item.name,
            item.ext || '');
        // TODO: maybe run in parallel?
        if (item.isFolder) {
            await item.download(path, this.pickPathSelector, config.FileStream.createDir);
        } else {
            await item.download(downloadPath);
        }
    }

    @action.bound async download() {
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
        const items = this.fileStore.selectedFilesOrFolders;
        let promise = Promise.resolve();
        items.forEach(item => {
            promise = promise.then(() => this.downloadOne(item, path));
        });
        await promise;
    }
}

module.exports = FileStoreBulk;
