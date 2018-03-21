// @ts-check

const { observable, computed, when } = require('mobx');
const contactStore = require('./../contacts/contact-store');
const User = require('./../user/user');
const Keg = require('./../kegs/keg');
const moment = require('moment');
const _ = require('lodash');
const { retryUntilSuccess } = require('../../helpers/retry');
const unfurl = require('../../helpers/unfurl');
const config = require('../../config');
const clientApp = require('../client-app');
const TaskQueue = require('../../helpers/task-queue');
const socket = require('../../network/socket');

/**
 * @typedef {{
       url : string
       length : number
       isOverInlineSizeLimit : boolean
       isOversizeCutoff : boolean
   }} ExternalImage
 */

/**
 * Message keg and model
 * @param {ChatStore} db - chat db
 * @extends {Keg}
 * @public
 */
class Message extends Keg {
    constructor(db) {
        super(null, 'message', db);
        // format 1 adds richText property to payload.
        // this property will be be overwritten when keg is dehydrated from older format data,
        this.format = 1;
        this.latestFormat = this.format;
    }

    static unfurlQueue = new TaskQueue(5);
    /**
     * @member {boolean} sending
     * @type {boolean} sending
     * @memberof Message
     * @instance
     * @public
     */
    @observable sending = false;
    /**
     * @member {boolean} sendError
     * @type {boolean} sendError
     * @memberof Message
     * @instance
     * @public
     */
    @observable sendError = false;
    /**
     * array of usernames to render receipts for
     * @member {Array<string>} receipts
     * @type {Array<string>} receipts
     * @memberof Message
     * @instance
     * @public
     */
    @observable receipts;
    /**
     * Which usernames are mentioned in this message.
     * @member {Array<string>} userMentions
     * @type {Array<string>} userMentions
     * @memberof Message
     * @instance
     * @public
     */
    @observable.shallow userMentions = [];
    // ----- calculated in chat store, used in ui
    /**
     * Is this message first in the day it was sent (and loaded message page)
     * @member {boolean} firstOfTheDay
     * @type {boolean} firstOfTheDay
     * @memberof Message
     * @instance
     * @public
     */
    @observable firstOfTheDay;
    /**
     * whether or not to group this message with previous one in message list.
     * @member {boolean} groupWithPrevious
     * @type {boolean} groupWithPrevious
     * @memberof Message
     * @instance
     * @public
     */
    @observable groupWithPrevious;

    /**
     * External image urls mentioned in this chat and safe to render in agreement with all settings.
     * @member {Array<ExternalImage>} externalImages
     * @type {Array<ExternalImage>} externalImages
     * @memberof Message
     * @instance
     * @public
     */
    @observable externalImages = [];

    /**
     * Indicates if current message contains at least one url.
     * @type {boolean}
     * @memberof Message
     * @public
     */
    @observable hasUrls = false;

    // -----
    /**
     * used to compare calendar days
     * @member {string} dayFingerprint
     * @memberof Message
     * @instance
     * @public
     */
    @computed get dayFingerprint() {
        if (!this.timestamp) return null;
        return this.timestamp.getDate().toString() +
            this.timestamp.getMonth().toString() +
            this.timestamp.getFullYear().toString();
    }

    /**
     * TODO: mobile uses this, but desktop uses
     * TODO: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
     * TODO: resolve/unify this in favor of most performant method
     * @member {string} messageTimestampText
     * @memberof Message
     * @instance
     * @public
     */
    @computed get messageTimestampText() {
        const { timestamp } = this;
        return timestamp ? moment(timestamp).format('LT') : null;
    }
    /**
     * Sends current message (saves the keg).
     * This function can be called as a reaction to user clicking 'retry' on failed message.
     * But because failure might have happened after we got a get id - we need to clear the keg id and version,
     * so the message doesn't confusingly appear out of order (messages are sorted by id)
     * @returns {Promise}
     * @protected
     */
    send() {
        this.sending = true;
        this.sendError = false;
        if (!this.tempId) this.assignTemporaryId();
        this.id = null;
        this.version = 0;
        this.sender = contactStore.currentUser;
        this.timestamp = new Date();
        let promise;
        // we want to auto-retry system messages and messages containing file attachments
        if (this.systemData || (this.files && this.files.length)) {
            promise = retryUntilSuccess(() => this.saveToServer());
        } else {
            promise = this.saveToServer();
        }
        return promise
            .catch(err => {
                this.sendError = true;
                console.error('Error sending message', err);
                return Promise.reject(err);
            })
            .finally(() => {
                this.sending = false;
            });
    }

    /**
     * Creates system metadata indicating chat rename.
     * @param {string} newName
     * @protected
     */
    setRenameFact(newName) {
        this.systemData = {
            action: 'rename',
            newName
        };
    }

    /**
     * Creates system metadata indicating chat purpose change.
     * @param {string} newPurpose
     * @protected
     */
    setPurposeChangeFact(newPurpose) {
        this.systemData = {
            action: 'purposeChange',
            newPurpose
        };
    }

    /**
     * Creates system metadata indicating chat creation.
     * @protected
     */
    setChatCreationFact() {
        this.systemData = { action: 'create' };
    }
    /**
     * Creates system metadata indicating admin sending user invitation to channel.
     * @param {Array<string>} usernames - array of invited usernames.
     * @protected
     */
    setChannelInviteFact(usernames) {
        this.systemData = {
            action: 'inviteSent',
            usernames
        };
    }
    /**
     * Creates system metadata indicating user accepting invite and joining channel.
     * @protected
     */
    setChannelJoinFact() {
        this.systemData = { action: 'join' };
    }
    /**
     * Creates system metadata indicating user leaving channel.
     * @protected
     */
    setChannelLeaveFact() {
        this.systemData = { action: 'leave' };
    }
    /**
     * Creates system metadata indicating admin removing user from a channel.
     * @param {string} username - username kicked from chat.
     * @protected
     */
    setUserKickFact(username) {
        this.systemData = {
            action: 'kick',
            username
        };
    }

    /**
     * Crates system metadata indicating admin assigning a role to user.
     * @param {string} username
     * @param {string} role - currently only 'admin'
     * @memberof Message
     */
    setRoleAssignFact(username, role) {
        this.systemData = {
            action: 'assignRole',
            username,
            role
        };
    }

    /**
     * Crates system metadata indicating admin removing a role from user.
     * @param {string} username
     * @param {string} role - currently only 'admin'
     * @memberof Message
     */
    setRoleUnassignFact(username, role) {
        this.systemData = {
            action: 'unassignRole',
            username,
            role
        };
    }

    /**
     * Sends a message containing jitsi link to the channel
     * @param {string} link
     * @memberof Message
     */
    sendVideoLink(link) {
        this.systemData = {
            action: 'videoCall',
            link
        };
    }

    /**
     * TODO: replace with the real thing
     */
    sendSharedFolder(folder) {
        this.systemData = {
            action: 'folder',
            folderName: folder.name,
            folderId: folder.folderId
        };
    }

    /**
     * Parses message to find urls or file attachments.
     * Verifies external url type and size and fills this.inlineImages.
     * @memberof Message
     */
    async parseExternalContent() {
        this.externalImages.clear();
        const settings = clientApp.uiUserPrefs;
        // it's not nice to run regex on every message,
        // but we'll remove this with richText release
        let urls = unfurl.getUrls(this.text);
        this.hasUrls = !!urls.length;

        if (!settings.externalContentEnabled) {
            return;
        }

        if (settings.externalContentJustForFavs && !this.sender.isMe) {
            await this.sender.ensureLoaded(); // need to make sure this contact is in fav list
            if (!this.sender.isAdded) return;
        }

        urls = Array.from(new Set(urls));// deduplicate
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            if (unfurl.urlCache[url]) {
                this._processUrlHeaders(url, unfurl.urlCache[url]);
            } else {
                this._queueUnfurl(url);
            }
        }
    }

    _queueUnfurl(url) {
        Message.unfurlQueue.addTask(() => {
            return unfurl.getContentHeaders(url)
                .catch(err => {
                    console.error(err);
                    // There's no reliable way to know if XMLHttpRequest has failed due to disconnection.
                    // Also, socket.connected is usually updated with a little delay,
                    // so we rely on this hacky way to postpone the connection check.
                    // We wait for socket to disconnect and will assume our headers request failed
                    // due to disconnection if socket disconnects within next few seconds.
                    // False positives are possible but harmless.
                    const dispose = when(
                        () => !socket.connected,
                        () => {
                            const queue = Message.unfurlQueue;
                            if (!queue.paused) {
                                when(() => socket.connected, () => queue.resume());
                                queue.pause();
                            }
                            this._queueUnfurl(url);
                        });
                    setTimeout(dispose, 2000);
                })
                .then(headers => {
                    if (headers) this._processUrlHeaders(url, headers);
                });
        });
    }

    _processUrlHeaders(url, headers) {
        if (!headers || !headers['content-type']) return;

        const type = headers['content-type'].split(';')[0];
        const length = +(headers['content-length'] || 0);// careful, +undefined is NaN

        if (!config.chat.allowedInlineContentTypes[type]) return;

        this.externalImages.push({
            url,
            length,
            isOverInlineSizeLimit:
                clientApp.uiUserPrefs.limitInlineImageSize && length > config.chat.inlineImageSizeLimit,
            isOversizeCutoff: length > config.chat.inlineImageSizeLimitCutoff
        });
    }

    serializeKegPayload() {
        this.userMentions = this.text
            ? _.uniq(this.db.participants.filter((u) => this.text.match(u.mentionRegex)).map((u) => u.username))
            : [];
        const ret = {
            text: this.text,
            timestamp: this.timestamp.valueOf(),
            userMentions: this.userMentions
        };
        this._serializeFileAttachments(ret);
        if (this.systemData) {
            ret.systemData = this.systemData;
        }
        if (this.richText) {
            ret.richText = this.richText;
        }
        return ret;
    }

    deserializeKegPayload(payload) {
        /**
         * @member {Contact} sender
         * @public
         */
        this.sender = contactStore.getContact(this.owner);
        /**
         * @member {string} text
         * @public
         */
        this.text = payload.text;

        /**
         * @member {Object=} richText
         * @public
         */
        this.richText = payload.richText;

        /**
         * For system messages like chat rename fact.
         * @member {Object} systemData
         * @public
         */
        this.systemData = payload.systemData;
        /**
         * @member {Date} timestamp
         * @public
         */
        this.timestamp = new Date(payload.timestamp);
        this.userMentions = payload.userMentions;
        /**
         * @member {Array<string>} files
         * @public
         */
        this.files = payload.files ? JSON.parse(payload.files) : null;
        /**
         * Does this message mention current user.
         * @member {boolean} isMention
         * @public
         */
        this.isMention = this.userMentions ? this.userMentions.includes(User.current.username) : false;
    }

    serializeProps() {
        const ret = {};
        this._serializeFileAttachments(ret);
        if (this.systemData) ret.systemAction = this.systemData.action;
        return ret;
    }

    _serializeFileAttachments(obj) {
        if (this.files) obj.files = JSON.stringify(this.files);
    }

    deserializeProps() {
        // files are in props only for search
    }
}

module.exports = Message;
