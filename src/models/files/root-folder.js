
const { computed } = require('mobx');
const FileFolder = require('./file-folder');
const volumeStore = require('../volumes/volume-store');

/* function mergeSortedArray(arr1, arr2) {
    const arr = [];
    let el1 = arr1[0];
    let el2 = arr2[0];
    let i = 1;
    let j = 1;
    while (el1 || el2) {
        if (el1 < el2 || (el1 && !el2)) {
            arr.push(el1);
            el1 = arr1[i++];
        } else {
            arr.push(el2);
            el2 = arr2[j++];
        }
    }
    return arr;
} */

class RootFolder extends FileFolder {
    constructor() {
        super('/');
    }

    @computed get virtualFolders() {
        return this.folders.concat(volumeStore.volumes);
    }

    serialize() {
        console.log(`root-folder: serialize dummy`);
        volumeStore.serialize();
        super.serialize();
    }

    deserialize(dataItem, parent, folderResolveMap, newFolderResolveMap) {
        console.log(`root-folder: deserialize dummy`);
        volumeStore.deserialize(this, newFolderResolveMap);
        return super.deserialize(dataItem, parent, folderResolveMap, newFolderResolveMap);
    }
}

module.exports = RootFolder;
