const warnings = require('../warnings');
const AbstractFolder = require('./abstract-folder');
const { retryUntilSuccess } = require('../../helpers/retry');
const { computed, action } = require('mobx');

function isLegacyFilePredicate(f) {
    return !!(f && f.isLegacy);
}
function hasLegacyFilesPredicate(f) {
    return !!(f && f.hasLegacyFiles);
}

class FileFolder extends AbstractFolder {
    constructor(store, name) {
        super(store, name === '/');
        this.name = this.isRoot ? '' : name;
    }

    @computed get hasLegacyFiles() {
        return !!(this.folders.find(hasLegacyFilesPredicate) || this.files.find(isLegacyFilePredicate));
    }

    // move file to this folder
    @action.bound add(file) {
        if (file.store !== this.store) {
            console.error('Can\'t add file to a folder in another store');
            return Promise.reject();
        }
        file.folderId = this.isRoot ? null : this.folderId;

        return retryUntilSuccess(
            () => file.saveToServer(),
            `saving file ${file.fileId}`,
            5
        ).tapCatch(() => {
            file.load();
        });
    }

    // move a folder to this folder
    @action.bound addFolder(folder) {
        if (folder.store !== this.store) {
            console.error('Can\'t add folder to a folder in another store');
            return;
        }
        if (this.findFolderByName(folder.normalizedName)) {
            warnings.addSevere('error_folderAlreadyExists');
            return;
        }
        folder.parentId = this.folderId;
        if (!this.store.folderStore.getById(folder.folderId)) {
            this.store.folderStore.folders.push(folder);
        }
        this.store.folderStore.save();
    }

    // removed folder tree entirely, including files
    remove(skipSave) {
        if (this.isRoot) return;
        this.files.forEach(f => f.remove());
        this.folders.forEach(f => f.remove(true));
        this.isDeleted = true;
        this.store.folderStore.folders.remove(this);
        if (skipSave) return;
        this.store.folderStore.save();
    }

    // move file or
    moveInto(fileOrFolder) {
        if (fileOrFolder.isFolder) {
            this.addFolder(fileOrFolder);
        } else {
            this.add(fileOrFolder);
        }
    }

    rename(name) {
        if (this.parent.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            return;
        }
        this.name = name;
        this.store.folderStore.save();
    }

    findFolderByName(name) {
        const normalizedName = name.toLowerCase();
        return this.folders.find(f => f.normalizedName === normalizedName);
    }

    serialize() {
        const { name, folderId, createdAt } = this;
        const folders = this.folders.map(f => f.serialize());
        return { name, folderId, createdAt, folders };
    }

    deserialize(data, parentId) {
        if (this.folderId && data.folderId !== this.folderId) {
            throw new Error('Trying to deserialize folder from a different folder data');
        }
        this.folderId = data.folderId;
        this.name = data.name;
        this.createdAt = data.createdAt;
        this.parentId = parentId;
        return this;
    }
}

module.exports = FileFolder;
