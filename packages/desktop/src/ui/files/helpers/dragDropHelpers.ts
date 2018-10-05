import { fileStore } from 'peerio-icebear';
import { getFileTree } from '~/helpers/file';

export function getAllDraggedItems() {
    return {
        filesOrFolders: fileStore.selectedFilesOrFolders,
        files: fileStore.selectedFiles,
        folders: fileStore.selectedFolders
    };
}

export async function uploadDroppedFiles(
    files: { path: string }[],
    targetFolder
) {
    const trees = [];
    for (let i = 0; i < files.length; i++) {
        const tree = await getFileTree(files[i].path);
        if (tree) trees.push(tree);
    }

    await Promise.map(trees, tree => {
        if (typeof tree === 'string') {
            return fileStore.upload(tree, null, targetFolder);
        }
        return fileStore.uploadFolder(tree, targetFolder);
    });
}
