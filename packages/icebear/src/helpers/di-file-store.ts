import { FileStore } from '../models/files/file-store';

/**
 * DI module to use models and stores avoiding cyclic requires
 */
let fileStore;

/**
 * Only FileStore needs this
 */
export function setFileStore(store: FileStore) {
    fileStore = store;
}
/**
 * Use this to avoid cyclic requires
 * @returns main file store instance
 */
export function getFileStore(): FileStore {
    return fileStore;
}
