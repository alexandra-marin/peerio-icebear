// @ts-check

const { when } = require('mobx');
const fileStore = require('../files/file-store');
const config = require('../../config');
const TaskQueue = require('../../helpers/task-queue');
const { retryUntilSuccess } = require('../../helpers/retry');
const socket = require('../../network/socket');

// for typechecking:
/* eslint-disable no-unused-vars */
const Chat = require('./chat');
const File = require('../files/file');
/* eslint-enable no-unused-vars */

/**
 * File handling module for Chat. Extracted for readability.
 * @param {Chat} chat - chat creates an instance and passes itself to it.
 * @public
 */
class ChatFileHandler {
    constructor(chat) {
        /**
         * @type {Chat} chat
         */
        this.chat = chat;
    }

    /**
     * TaskQueue of files to share for paced process.
     * @member {TaskQueue} shareQueue
     * @protected
     */
    shareQueue = new TaskQueue(1, 2000);

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
     * @public
     */
    uploadAndShare(path, name, deleteAfterUpload = false, beforeShareCallback = null, message) {
        const file = fileStore.upload(path, name);
        file.uploadQueue = this.chat.uploadQueue; // todo: change, this is dirty
        this.chat.uploadQueue.push(file);
        const deletedDisposer = when(() => file.deleted, () => {
            this.chat.uploadQueue.remove(file);
        });
        when(() => file.readyForDownload, () => {
            this.chat.uploadQueue.remove(file);
            if (beforeShareCallback) {
                beforeShareCallback().then(() => this.share([file]));
            } else {
                this.share([file], message);
            }
            if (deleteAfterUpload) {
                config.FileStream.delete(path);
            }
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
    share(files, message = '') {
        // @ts-ignore no bluebird-promise assignability with jsdoc
        return Promise.map(files, (f) => {
            return this.shareQueue.addTask(() => {
                const ids = this.shareFileKegs([f]);
                return this.chat.sendMessage(message, ids);
            });
        });
    }


    /**
     * Shares existing Peerio files with a chat.
     * This function performs only logical sharing, provides permissions/access for recipients.
     * It doesn't inform recipients in the chat about the fact of sharing.
     * @param {Array<File>} files
     * @return {Array<string>} - fileId list
     * @private
     */
    shareFileKegs(files) {
        if (!files || !files.length) return null;
        const ids = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // todo: handle failure
            file.share(this.chat.otherParticipants);
            ids.push(file.fileId);
        }
        return ids;
    }

    getRecentFiles() {
        return retryUntilSuccess(() => {
            return socket.send(
                '/auth/kegs/db/files/latest',
                { kegDbId: this.chat.id, count: config.chat.recentFilesDisplayLimit }
            )
                .then(res => {
                    const ids = [];
                    res.forEach(raw => {
                        const fileIds = JSON.parse(raw);
                        fileIds.forEach(id => {
                            if (!ids.includes(id)) ids.push(id);
                        });
                    });
                    return ids;
                });
        });
    }
}
module.exports = ChatFileHandler;
