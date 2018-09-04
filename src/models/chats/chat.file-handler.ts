import { when } from 'mobx';
import fileStore from '../files/file-store';
import config from '../../config';
import socket from '../../network/socket';
import tracker from '../update-tracker';
import { getUser } from '../../helpers/di-current-user';
import File from '../files/file';
import Chat from './chat';

/**
 * File handling module for Chat. Extracted for readability.
 * @param  chat - chat creates an instance and passes itself to it.
 */
class ChatFileHandler {
    constructor(chat: Chat) {
        this.chat = chat;
        tracker.subscribeToKegUpdates(chat.id, 'file', this.onFileDigestUpdate);
        tracker.onUpdated(this.onFileDigestUpdate, true);
    }

    chat: Chat;

    knownUpdateId = '';
    maxUpdateId = '';
    copyingFiles: boolean;

    onFileDigestUpdate = async (_kegDbId, digestEnsured) => {
        const msgDigest = tracker.getDigest(this.chat.id, 'file');
        this.maxUpdateId = msgDigest.maxUpdateId;
        if (this.knownUpdateId < msgDigest.knownUpdateId)
            this.knownUpdateId = msgDigest.knownUpdateId;
        if (!this.maxUpdateId) return;
        if (!this.knownUpdateId && !digestEnsured) {
            await this.chat.ensureDigestLoaded();
            this.onFileDigestUpdate(null, true);
            return;
        }
        this.copyFileKegs();
    };

    copyFileKegs() {
        if (!this.maxUpdateId || this.maxUpdateId === this.knownUpdateId || this.copyingFiles)
            return;
        this.copyingFiles = true;
        socket
            .send(
                '/auth/kegs/db/query',
                {
                    kegDbId: this.chat.db.id,
                    type: 'file',
                    filter: {
                        collectionVersion: { $gt: this.knownUpdateId }
                    }
                },
                false
            )
            .then(async resp => {
                if (!resp.kegs || !resp.kegs.length) return;

                for (const keg of resp.kegs) {
                    if (this.knownUpdateId < keg.collectionVersion) {
                        this.knownUpdateId = keg.collectionVersion;
                    }
                    if (keg.deleted) {
                        fileStore.removeCachedChatKeg(this.chat.id, keg.kegId);
                        return;
                    }
                    const file = new File(this.chat.db, fileStore);
                    try {
                        if ((await file.loadFromKeg(keg)) && !file.deleted) {
                            fileStore.updateCachedChatKeg(this.chat.id, file);
                            if (this.chat.isChannel) {
                                return;
                            }
                            // it's our own file, no need to copy to SELF
                            if (keg.props.descriptor.owner === getUser().username) return;
                            // Not waiting for this to resolve. Internally it will do retries,
                            // but on larger scale it's too complicated to handle recovery
                            // from non-connection related errors
                            file.copyTo(getUser().kegDb, fileStore);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
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
     * @param path - full file path
     * @param name - override file name, specify to store the file keg with this name
     * @param deleteAfterUpload - delete local file after successful upload
     * @param message - message to attach to file
     */
    uploadAndShare(path: string, name?: string, deleteAfterUpload = false, message?: string): File {
        const file = fileStore.upload(path, name);
        file.uploadQueue = this.chat.uploadQueue; // todo: change, this is dirty
        this.chat.uploadQueue.push(file);
        const removeFileFromQueue = () => this.chat.uploadQueue.remove(file);
        const deletedDisposer = when(() => file.deleted, removeFileFromQueue);
        when(
            () => file.readyForDownload,
            async () => {
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
            }
        );
        return file;
    }

    /**
     * Shares previously uploaded files to chat.
     * @param [message = ''] message to attach to file
     */
    async share(files: File[], message = '') {
        if (!files || !files.length) return Promise.reject();
        await Promise.map(files, f => f.share(this.chat));
        const ids = files.map(f => f.fileId);
        return this.chat.sendMessage(message, ids);
    }

    /**
     *
     * @param file - file id or instance
     */
    async unshare(file: string | File) {
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
export default ChatFileHandler;
