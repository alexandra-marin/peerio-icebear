const { action, computed } = require('mobx');
const { getChatStore } = require('../../helpers/di-chat-store');
const volumeStore = require('../volumes/volume-store');

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
        } else {
            await volumeStore.deleteVolume(i);
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

    @action.bound move() {
    }
}

module.exports = FileStoreBulk;
