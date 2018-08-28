//
// Download module for File model, for code file length sake
//

import config from '../../config';
import warnings from './../warnings';
import FileDownloader from './file-downloader';
import FileCacheHandler from './file-cache-handler';
import cryptoUtil from '../../crypto/util';
import FileNonceGenerator from './file-nonce-generator';
import TinyDb from '../../db/tiny-db';
import { action } from 'mobx';
import socket from '../../network/socket';

function _getDlResumeParams(path) {
    return config.FileStream.getStat(path)
        .then(stat => {
            if (stat.size >= this.size) {
                return Promise.resolve(false); // do not download
            }
            const wholeChunks = Math.floor(stat.size / this.chunkSize);
            const partialChunkSize = stat.size % this.chunkSize;
            return { wholeChunks, partialChunkSize };
        })
        .catch(err => {
            console.log(err);
            return Promise.resolve(true); // download from start
        });
}

function downloadToTmpCache() {
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
function download(
    filePath: string,
    resume = false,
    isTmpCacheDownload = false,
    suppressSnackbar = false
) {
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
        let p = Promise.resolve(true);
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
function cancelDownload() {
    this._saveDownloadEndFact();
    this._resetDownloadState();
}

/**
 * Removes download cache if it exists
 */
function removeCache() {
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

function _saveDownloadStartFact(path) {
    TinyDb.user.setValue(`DOWNLOAD:${this.fileId}`, {
        fileId: this.fileId,
        path
    });
}

function _saveDownloadEndFact() {
    TinyDb.user.removeValue(`DOWNLOAD:${this.fileId}`);
}

function _resetDownloadState(stream) {
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

export default function(File) {
    File.prototype._getDlResumeParams = _getDlResumeParams;
    File.prototype.download = download;
    File.prototype.downloadToTmpCache = downloadToTmpCache;
    File.prototype.cancelDownload = cancelDownload;
    File.prototype.removeCache = removeCache;
    File.prototype._saveDownloadStartFact = _saveDownloadStartFact;
    File.prototype._saveDownloadEndFact = _saveDownloadEndFact;
    File.prototype._resetDownloadState = _resetDownloadState;
}
