const createMap = require('../../helpers/dynamic-array-map');
const warnings = require('../warnings');
const AbstractFolder = require('./abstract-folder');
const { retryUntilSuccess } = require('../../helpers/retry');

class FileFolder extends AbstractFolder {
    constructor(name) {
        super();
        const m = createMap(this.files, 'fileId');
        this.name = name;
        this.fileMap = m.map;
        this.fileMapObservable = m.observableMap;
        const m2 = createMap(this.folders, 'folderId');
        this.folderMap = m2.map;
    }

    add(file, skipSaving) {
        if (this.fileMap[file.fileId]) {
            return;
        }
        if (file.folder) {
            console.error('file already belongs to a folder');
            return;
        }
        file.folder = this;
        file.folderId = this.isRoot ? null : this.folderId;

        if (!skipSaving) {
            retryUntilSuccess(
                () => file.saveToServer(),
                `moving file ${file.fileId}`,
                2
            );
        }
        this.files.push(file);
    }

    addFolder(folder) {
        if (folder.parent === this) return folder;
        if (this.folderMap[folder.folderId]) {
            return folder;
        }
        if (folder.parent) {
            console.debug('moving folder from parent');
            folder.parent.freeFolder(folder);
        }
        folder.parent = this;
        this.folders.push(folder);
        return folder;
    }

    free(file) {
        if (!this.fileMap[file.fileId]) {
            console.error('file does not belong to the folder');
            return;
        }
        const i = this.files.indexOf(file);
        if (i !== -1) {
            this.files.splice(i, 1);
            file.folder = null;
        } else {
            console.error('free cannot find the file');
        }
    }

    freeFolder(folder) {
        const i = this.folders.indexOf(folder);
        if (i !== -1) {
            this.folders.splice(i, 1);
            folder.parent = null;
        } else {
            console.error('free cannot find the folder');
        }
    }

    remove() {
        if (this.isRoot) return;
        let root = this;
        while (!root.isRoot) root = root.parent;
        this.files.forEach(file => {
            file.folder = null;
            root.add(file);
        });
        this.files = [];
        this.folders.forEach(folder => folder.remove());
        this.folders = [];
        this.parent && this.parent.freeFolder(this);
        this.isDeleted = true;
    }

    moveInto(file) {
        if (file.isFolder) {
            if (this.findFolderByName(file.normalizedName)) {
                warnings.addSevere('error_folderAlreadyExists');
                throw new Error('error_folderAlreadyExists');
            }
            if (file === this) {
                console.error('cannot move folder in itself');
                return;
            }
            file.parent.freeFolder(file);
            this.addFolder(file);
        } else {
            if (file.folder) file.folder.free(file);
            this.add(file);
        }
    }

    rename(name) {
        if (this.parent.findFolderByName(name)) {
            warnings.addSevere('error_folderAlreadyExists');
            throw new Error('error_folderAlreadyExists');
        }
        this.name = name;
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

    deserialize(dataItem, parent, folderResolveMap, newFolderResolveMap) {
        const { folderId, name, createdAt, folders } = dataItem;
        Object.assign(this, { folderId, name, createdAt });
        folders && folders.map(f => {
            let folder = folderResolveMap[f.folderId];
            if (!folder) {
                folder = new FileFolder();
            }
            folder.deserialize(f, this, folderResolveMap, newFolderResolveMap);
            newFolderResolveMap[f.folderId] = folder;
            return folder;
        });
        parent && parent.addFolder(this);
        return this;
    }
}

module.exports = FileFolder;
