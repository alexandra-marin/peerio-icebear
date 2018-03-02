const { action, computed } = require('mobx');

/**
 * Extension to operate with selected files and folders in bulk
 */
class FileStoreBulk {
    constructor(fileStore) {
        this.fileStore = fileStore;
    }

    @computed get canMove() {
        return true;
    }

    @action.bound async remove() {
        const items = this.fileStore.selectedFilesOrFolders;
        let promise = Promise.resolve();
        items.forEach(i => {
            promise = promise.then(async () => {
                if (i.isFolder && !i.isShared) {
                    await this.fileStore.folders.deleteFolder(i);
                } else {
                    await i.remove();
                }
            });
        });
        await items;
        this.fileStore.clearSelection();
    }

    @action.bound move() {
    }
}

module.exports = FileStoreBulk;
