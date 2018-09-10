import LRU from 'lru-cache';
import { when } from 'mobx';
import config from '../../config';

const fileCacheOptions = {
    max: config.temporaryCacheLimit,
    noDisposeOnSet: true,
    // calculate the size item takes
    length(file) {
        return file.size;
    },
    // remove the item from cache
    dispose(key, file) {
        // to avoid solving probable but unlikely complicated situations when total size of visible files
        // exceeds cache limit, we are deleting file whenever it does become invisible
        // it may lead to actual cache size exceeding our limit, but this should be a non-issue
        console.debug(`trying to dispose: ${key}, ${file.tmpCachePath}`);
        when(
            () => !file.visibleCounter,
            () => {
                console.debug(`removing file: ${key}, ${file.tmpCachePath}`);
                file.removeCache();
            }
        );
    }
};

const fileCache = LRU(fileCacheOptions);

class FileCacheHandler {
    static cacheMonitor(file) {
        fileCache.set(file.fileId, file);
    }
}

export default FileCacheHandler;
