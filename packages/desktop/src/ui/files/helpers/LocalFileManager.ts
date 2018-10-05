import { action, observable } from 'mobx';
import { fileStore } from 'peerio-icebear';
import { pickLocalFiles, getFileTree } from '~/helpers/file';

export default class LocalFileManager {
    /**
     * Number of active file tree scans.
     *
     * When a user picks files/folders, we increment this counter
     * and read the file tree from the file system. Once we got
     * the tree, we decrement it and begin uploading.
     */
    @observable preparingForUpload = 0;

    @action.bound
    async pickAndUpload(): Promise<void> {
        const paths = await pickLocalFiles();
        if (!paths || !paths.length) return;
        await this.uploadFileTree(paths, fileStore.folderStore.currentFolder);
    }

    @action.bound
    async uploadFileTree(files: string[], targetFolder: string): Promise<void> {
        const trees = [];
        try {
            this.preparingForUpload++;
            for (let i = 0; i < files.length; i++) {
                const tree = await getFileTree(files[i]);
                if (tree) trees.push(tree);
            }
        } finally {
            this.preparingForUpload--;
        }

        await Promise.map(trees, tree => {
            if (typeof tree === 'string') {
                return fileStore.upload(tree, null, targetFolder);
            }
            return fileStore.uploadFolder(tree, targetFolder);
        });
    }
}
