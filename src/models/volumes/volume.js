const createMap = require('../../helpers/dynamic-array-map');
// const warnings = require('../warnings');
const AbstractFolder = require('../files/abstract-folder');

class Volume extends AbstractFolder {
    isShared = true;

    constructor(name) {
        super();
        const m = createMap(this.files, 'fileId');
        this.name = name;
        this.fileMap = m.map;
        this.fileMapObservable = m.observableMap;
        const m2 = createMap(this.folders, 'folderId');
        this.folderMap = m2.map;
    }

    add(file) {
        if (this.fileMap[file.fileId]) {
            return;
        }
        if (file.folder) {
            console.error('file already belongs to a folder');
            return;
        }
        file.folder = this;
        file.folderId = this.isRoot ? null : this.folderId;
        this.files.push(file);
    }

    moveInto(file) {
        if (file.isFolder) {
            console.error('moving folders into shared folders is not implemented');
        } else {
            // removing from existing folder or volume
            if (file.folder) file.folder.free(file);
            this.add(file);
        }
    }
}

module.exports = Volume;
