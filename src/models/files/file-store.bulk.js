const { action, computed } = require('mobx');

/**
 * Extension to operate with selected files and folders in bulk
 */
class FileStoreBulk {
    // functor taking folder as an argument to confirm folder deletion
    deleteFolderConfirmator = null;

    // functor taking files and shared fiels as an argument to confirm
    // folder deletion
    deleteFolderConfirmator = null;

    constructor(fileStore) {
        this.fileStore = fileStore;
    }

    @computed get canMove() {
        return true;
    }

    async removeOne(i, batch) {
        if (i.isFolder && this.deleteFolderConfirmator) {
            if (!await this.deleteFolderConfirmator(i)) return;
        }
        if (i.isFolder && !i.isShared) {
            await this.fileStore.folders.deleteFolder(i);
            if (!batch) this.fileStore.folders.save();
        } else {
            await i.remove();
        }
    }

    @action.bound async remove() {
        const items = this.fileStore.selectedFilesOrFolders;
        if (this.deleteFilesConfirmator) {
            const files = items.filter(i => !i.isFolder);
            const sharedFiles = items.some(i => i.shared);
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

    @action.bound move() {
    }
}

module.exports = FileStoreBulk;
