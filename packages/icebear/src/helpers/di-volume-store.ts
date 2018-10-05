import { VolumeStore } from '../models/volumes/volume-store';

/**
 * DI module to use models and stores avoiding cyclic requires
 */
let volumeStore;

/**
 * Only VolumeStore needs this
 */
export function setVolumeStore(store: VolumeStore) {
    volumeStore = store;
}
/**
 * Use this to avoid cyclic requires
 */
export function getVolumeStore(): VolumeStore {
    return volumeStore;
}
