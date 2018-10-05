import { action } from 'mobx';

import { User, fileStore } from 'peerio-icebear';

import { selectDownloadFolder } from '~/helpers/file';

// TODO/TS: use icebear types when defined
export interface Folder {
    name: string;
    isFolder: true;
    isShared: boolean;
    selected: boolean;
    rename(newName: string): void;
}

export interface File {
    name: string;
    isFolder: undefined;
    selected: boolean;
    isShared: boolean;
    canShare: boolean;
    readyForDownload: boolean;
    fileOwner: string;
    downloading: boolean;
}

export type FileOrFolder = File | Folder;

export type ShareContext = 'sharefiles' | 'sharefolders' | '';

/*
 * TODO: any of these that could be sensibly placed on the icebear models might
 * as well be there.
 *
 * in keeping with the OO style of icebear (such as it exists) it might make
 * sense to have augmented versions of the file/folder models for
 * environment-specific actions (eg. where we use dom or electron apis) in
 * desktop, mobile, etc., rather than static methods as in this file. that's
 * something that could be explored later.
 *
 * (this would also probably make a lot more sense for view-model properties
 * like "selected", etc., which currently just reside on the models proper.)
 */

export function isFileOrFolderMoveable(fileOrFolder: FileOrFolder): boolean {
    // if the root folder doesn't have any folders in it, we can't move anything anywhere.
    if (!fileStore.folderStore.root.hasNested) return false;
    // if a folder is shared, it's not moveable.
    if (fileOrFolder.isFolder && fileOrFolder.isShared) return false;
    return true;
}

export function fileDownloadUIEnabled(file: File): boolean {
    return file.readyForDownload && !file.downloading;
}

export function isFileShareable(file: File): boolean {
    return file.readyForDownload && file.canShare;
}

export function isFileOwnedByCurrentUser(file: File): boolean {
    return file.fileOwner === User.current.username;
}

export async function downloadFolder(folder: Folder): Promise<void> {
    const path = await selectDownloadFolder();
    if (!path) return;
    fileStore.bulk.downloadOne(folder, path);
}

export function deleteFileOrFolder(fileOrFolder: FileOrFolder): void {
    fileStore.bulk.removeOne(fileOrFolder);
}

export const handleSearch = action((val: string) => {
    fileStore.searchQuery = val;
});

export const toggleFileOrFolderSelected = action(
    (fileOrFolder: FileOrFolder) => {
        fileOrFolder.selected = !fileOrFolder.selected;
    }
);

export const setCurrentFolder = action((folder: Folder) => {
    if (folder !== fileStore.folderStore.currentFolder) {
        fileStore.folderStore.currentFolder = folder;
        fileStore.searchQuery = '';
        fileStore.clearSelection();
    }
});
