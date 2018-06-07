const { when } = require('mobx');
const fileStore = require('../files/file-store');
const config = require('../../config');
const { retryUntilSuccess } = require('../../helpers/retry');
const socket = require('../../network/socket');
const tracker = require('../update-tracker');
const { getUser } = require('../../helpers/di-current-user');
const File = require('../files/file');

/**
 * File handling module for Chat. Extracted for readability.
 * @param {Chat} chat - chat creates an instance and passes itself to it.
 */
class ChatFileHandler {
    knownUpdateId = '';
    maxUpdateId = '';
    constructor(chat) {
        /**
         * @type {Chat}
         */
        this.chat = chat;
        tracker.subscribeToKegUpdates(chat.id, 'file', this.onFileDigestUpdate);
        tracker.onUpdated(this.onFileDigestUpdate, true);
    }

    onFileDigestUpdate = () => {
        const msgDigest = tracker.getDigest(this.chat.id, 'file');
        this.maxUpdateId = msgDigest.maxUpdateId;
        if (this.knownUpdateId < msgDigest.knownUpdateId) this.knownUpdateId = msgDigest.knownUpdateId;
        this.copyFileKegs();
    }


    copyFileKegs() {
        if (!this.maxUpdateId || this.maxUpdateId === this.knownUpdateId || this.copyingFiles) return;
        this.copyingFiles = true;
        socket.send('/auth/kegs/db/query', {
            kegDbId: this.chat.db.id,
            type: 'file',
            filter: {
                collectionVersion: { $gt: this.knownUpdateId }
            }
        }, false)
            .then(resp => {
                if (!resp.kegs || !resp.kegs.length) return;

                resp.kegs.forEach(keg => {
                    if (this.knownUpdateId < keg.collectionVersion) {
                        this.knownUpdateId = keg.collectionVersion;
                    }
                    if (keg.deleted) {
                        fileStore.removeCachedChatKeg(this.chat.id, keg.kegId);
                        return;
                    }
                    const file = new File(this.chat.db, fileStore);
                    try {
                        if (file.loadFromKeg(keg) && !file.deleted) {
                            fileStore.updateCachedChatKeg(this.chat.id, file);
                            if (this.chat.isChannel) {
                                return;
                            }
                            // Not waiting for this to resolve. Internally it will do retries,
                            // but on larger scale it's too complicated to handle recovery
                            // from non-connection related errors
                            file.copyTo(getUser().kegDb, fileStore);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });
            })
            .then(() => {
                this.copyingFiles = false;
                tracker.seenThis(this.chat.db.id, 'file', this.knownUpdateId);
                setTimeout(this.onFileDigestUpdate);
            })
            .catch(err => {
                console.error('Error copying fileKegs to SELF', err);
                this.copyingFiles = false;
            });
    }

    /**
     * Initiates file upload and shares it to the chat afterwards.
     * Note that if app session ends before this is done - files will be only uploaded by resume logic.
     * But chat message will not be sent.
     * @param {string} path - full file path
     * @param {string} [name] - override file name, specify to store the file keg with this name
     * @param {boolean} [deleteAfterUpload=false] - delete local file after successful upload
     * @param {function} [beforeShareCallback=null] - function returning Promise which will be waited for
     *                                                before file is shared. We need this to finish keg preparations.
     * @param {string} [message=null] - message to attach to file
     * @returns {File}
     */
    uploadAndShare(path, name, deleteAfterUpload = false, message) {
        const file = fileStore.upload(path, name);
        file.uploadQueue = this.chat.uploadQueue; // todo: change, this is dirty
        this.chat.uploadQueue.push(file);
        const removeFileFromQueue = () => this.chat.uploadQueue.remove(file);
        const deletedDisposer = when(() => file.deleted, removeFileFromQueue);
        when(() => file.readyForDownload, async () => {
            try {
                await this.share([file], message);
                if (deleteAfterUpload) {
                    config.FileStream.delete(path);
                }
            } catch (e) {
                console.error(e);
            }
            removeFileFromQueue();
            deletedDisposer();
        });
        return file;
    }


    /**
     * Shares previously uploaded files to chat.
     * @param {Array<File>} files
     * @param {string} [message = ''] message to attach to file
     * @returns {Promise}
     */
    async share(files, message = '') {
        if (!files || !files.length) return Promise.reject();
        await Promise.map(files, f => f.share(this.chat));
        const ids = files.map(f => f.fileId);
        return this.chat.sendMessage(message, ids);
    }

    /**
     *
     * @param {string|File} file - file id or instance
     */
    async unshare(file) {
        if (typeof file === 'string') {
            file = fileStore.getByIdInChat(file, this.chat.id); // eslint-disable-line no-param-reassign
            await file.ensureLoaded();
            if (file.deleted) return Promise.resolve();
        }
        if (file.db.id !== this.chat.id) {
            return Promise.reject(
                new Error('Attempt to unshare file from kegdb it does not belong to.')
            );
        }
        return file.remove();
    }
}
module.exports = ChatFileHandler;
