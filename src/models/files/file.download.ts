//
// Download module for File model, for code file length sake
//

import config from '../../config';
import warnings from './../warnings';
import FileDownloader from './file-downloader';
import FileCacheHandler from './file-cache-handler';
import * as cryptoUtil from '../../crypto/util';
import FileNonceGenerator from './file-nonce-generator';
import TinyDb from '../../db/tiny-db';
import { action } from 'mobx';
import socket from '../../network/socket';
import File from './file';
// @ts-ignore to support desktop declarations emit until monorepo
import Bluebird from 'bluebird';

export function _getDlResumeParams(this: File, path) {
    return config.FileStream.getStat(path)
        .then(
            (stat): { wholeChunks: number; partialChunkSize: number } | boolean => {
                if (stat.size >= this.size) {
                    return false; // do not download
                }
                const wholeChunks = Math.floor(stat.size / this.chunkSize);
                const partialChunkSize = stat.size % this.chunkSize;
                return { wholeChunks, partialChunkSize };
            }
        )
        .catch(err => {
            console.log(err);
            return true; // download from start
        });
}

export function downloadToTmpCache(this: File) {
    return this.download(this.tmpCachePath, true, true)
        .then(() => FileCacheHandler.cacheMonitor(this))
        .tapCatch(() => {
            this.cachingFailed = true;

            // XHR usually fails before socket detects disconnection
            if (socket.authenticated) {
                socket.onceDisconnected(() => {
                    socket.onceAuthenticated(() => this.tryToCacheTemporarily());
                });
            } else {
                socket.onceAuthenticated(() => this.tryToCacheTemporarily());
            }
        });
}

const tempExt = '.peeriodownload';
/**
 * Starts download.
 * @param filePath - where to store file (including name)
 * @param resume - for system use
 */
export function download(
    this: File,
    filePath: string,
    resume = false,
    isTmpCacheDownload = false,
    suppressSnackbar = false
) {
    if (!this.readyForDownload) return Promise.reject(new Error('File is not ready to download'));
    // we need this check because resume process will pass temp file name
    if (!filePath.endsWith(tempExt)) {
        filePath = `${filePath}${tempExt}`; // eslint-disable-line no-param-reassign
    }
    if (this.downloading || this.uploading) {
        return Promise.reject(
            new Error(`File is already ${this.downloading ? 'downloading' : 'uploading'}`)
        );
    }
    try {
        this.progress = 0;
        this._resetDownloadState();
        this.downloading = true;
        if (!isTmpCacheDownload) {
            this._saveDownloadStartFact(filePath);
        }
        const nonceGen = new FileNonceGenerator(
            0,
            this.chunksCount - 1,
            cryptoUtil.b64ToBytes(this.blobNonce)
        );
        let stream,
            mode = 'write';
        let p = Promise.resolve(true) as Promise<
            boolean | { wholeChunks: number; partialChunkSize: number }
        >;
        if (resume) {
            p = this._getDlResumeParams(filePath);
        }
        return p
            .then(resumeParams => {
                if (resumeParams === false) return null;
                if (resumeParams !== true) {
                    mode = 'append';
                } else resumeParams = null; // eslint-disable-line no-param-reassign

                stream = new config.FileStream(filePath, mode);
                return stream.open().then(() => {
                    this.downloader = new FileDownloader(this, stream, nonceGen, resumeParams);
                    return this.downloader.start();
                });
            })
            .then(() => {
                if (!isTmpCacheDownload) {
                    this._saveDownloadEndFact();
                }
                this._resetDownloadState(stream);
                const finalPath = filePath.substr(0, filePath.length - tempExt.length);
                return config.FileStream.rename(filePath, finalPath);
            })
            .then(
                action(() => {
                    if (!isTmpCacheDownload) {
                        this.cached = true; // currently for mobile only
                        if (!suppressSnackbar) warnings.add('snackbar_downloadComplete');
                    } else {
                        this.tmpCached = true;
                    }
                })
            )
            .catch(err => {
                console.error(err);
                if (err) {
                    if (err.name === 'UserCancelError') {
                        return Promise.reject(err);
                    }
                    if (!socket.authenticated || err.name === 'DisconnectedError') {
                        this._resetDownloadState();
                        return Promise.reject(err);
                    }
                }
                if (!isTmpCacheDownload) {
                    warnings.addSevere('error_downloadFailed', 'title_error', {
                        fileName: this.name
                    });
                }
                this.cancelDownload();
                return Promise.reject(err || new Error('Download failed.'));
            });
    } catch (ex) {
        this.cancelDownload();
        console.error(ex);
        return Promise.reject(ex);
    }
}

/**
 * Cancels download and removes impartially downloaded file.
 */
export function cancelDownload(this: File) {
    this._saveDownloadEndFact();
    this._resetDownloadState();
}

/**
 * Removes download cache if it exists
 */
export function removeCache(this: File) {
    return Promise.resolve(
        (async () => {
            if (!this.tmpCached) return;
            try {
                await config.FileStream.delete(this.tmpCachePath);
            } catch (e) {
                console.error(e);
            }
            this.tmpCached = false;
        })()
    );
}

export function _saveDownloadStartFact(this: File, path) {
    TinyDb.user.setValue(`DOWNLOAD:${this.fileId}`, {
        fileId: this.fileId,
        path
    });
}

export function _saveDownloadEndFact(this: File) {
    TinyDb.user.removeValue(`DOWNLOAD:${this.fileId}`);
}

export function _resetDownloadState(this: File, stream) {
    this.uploading = false;
    this.downloading = false;
    this.uploader && this.uploader.cancel();
    this.downloader && this.downloader.cancel();
    this.uploader = null;
    this.downloader = null;
    this.cachingFailed = false;
    // this.progress = 0;
    try {
        if (stream) stream.close();
    } catch (ex) {
        console.error(ex);
    }
}
