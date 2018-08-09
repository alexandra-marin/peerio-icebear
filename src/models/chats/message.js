// @ts-check

const { observable, computed, when } = require('mobx');
const contactStore = require('./../contacts/contact-store');
const User = require('./../user/user');
const Keg = require('./../kegs/keg').default;
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
     * @type {boolean}
     */
    @observable sending = false;
    /**
     * @type {boolean}
     */
    @observable sendError = false;
    /**
     * array of usernames to render receipts for
     * @type {Array<string>}
     */
    @observable receipts;
    /**
     * Which usernames are mentioned in this message.
     * @type {Array<string>}
     */
    @observable.shallow userMentions = [];
    // ----- calculated in chat store, used in ui
    /**
     * Is this message first in the day it was sent (and loaded message page)
     * @type {boolean}
     */
    @observable firstOfTheDay;
    /**
     * whether or not to group this message with previous one in message list.
     * @type {boolean}
     */
    @observable groupWithPrevious;

    /**
     * External image urls mentioned in this chat and safe to render in agreement with all settings.
     * @type {Array<ExternalImage>}
     */
    @observable externalImages = [];

    /**
     * Indicates if current message contains at least one url.
     * @type {boolean}
     */
    @observable hasUrls = false;

    // -----
    /**
     * used to compare calendar days
     * @type {string}
     */
    @computed
    get dayFingerprint() {
        if (!this.timestamp) return null;
        return (
            this.timestamp.getDate().toString() +
            this.timestamp.getMonth().toString() +
            this.timestamp.getFullYear().toString()
        );
    }

    /**
     * TODO: mobile uses this, but desktop uses
     * TODO: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
     * TODO: resolve/unify this in favor of most performant method
     * @type {string}
     */
    @computed
    get messageTimestampText() {
        const { timestamp } = this;
        return timestamp ? moment(timestamp).format('LT') : null;
    }
    /**
     * Sends current message (saves the keg).
     * This function can be called as a reaction to user clicking 'retry' on failed message.
     * But because failure might have happened after we got a get id - we need to clear the keg id and version,
     * so the message doesn't confusingly appear out of order (messages are sorted by id)
     * @returns {Promise}
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
        if (
            this.systemData ||
            (this.files && this.files.length) ||
            (this.folders && this.folders.length)
        ) {
            promise = retryUntilSuccess(
                () => this.saveToServer(),
                undefined,
                5
            );
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
     */
    setPurposeChangeFact(newPurpose) {
        this.systemData = {
            action: 'purposeChange',
            newPurpose
        };
    }

    /**
     * Creates system metadata indicating chat creation.
     */
    setChatCreationFact() {
        this.systemData = { action: 'create' };
    }
    /**
     * Creates system metadata indicating admin sending user invitation to channel.
     * @param {Array<string>} usernames - array of invited usernames.
     */
    setChannelInviteFact(usernames) {
        this.systemData = {
            action: 'inviteSent',
            usernames
        };
    }
    /**
     * Creates system metadata indicating user accepting invite and joining channel.
     */
    setChannelJoinFact() {
        this.systemData = { action: 'join' };
    }
    /**
     * Creates system metadata indicating user leaving channel.
     */
    setChannelLeaveFact() {
        this.systemData = { action: 'leave' };
    }
    /**
     * Creates system metadata indicating admin removing user from a channel.
     * @param {string} username - username kicked from chat.
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
     */
    sendVideoLink(link) {
        this.systemData = {
            action: 'videoCall',
            link
        };
    }

    /**
     * Parses message to find urls or file attachments.
     * Verifies external url type and size and fills this.inlineImages.
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

        urls = Array.from(new Set(urls)); // deduplicate
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
            return unfurl
                .getContentHeaders(url)
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
                                when(
                                    () => socket.connected,
                                    () => queue.resume()
                                );
                                queue.pause();
                            }
                            this._queueUnfurl(url);
                        }
                    );
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
        const length = +(headers['content-length'] || 0); // careful, +undefined is NaN

        if (!config.chat.allowedInlineContentTypes[type]) return;

        this.externalImages.push({
            url,
            length,
            isOverInlineSizeLimit:
                clientApp.uiUserPrefs.limitInlineImageSize &&
                length > config.chat.inlineImageSizeLimit,
            isOversizeCutoff: length > config.chat.inlineImageSizeLimitCutoff
        });
    }

    serializeKegPayload() {
        this.format = this.latestFormat;
        this.userMentions = this.text
            ? _.uniq(
                  this.db.participants
                      .filter(u => this.text.match(u.mentionRegex))
                      .map(u => u.username)
              )
            : [];
        const ret = {
            text: this.text,
            timestamp: this.timestamp.valueOf(),
            userMentions: this.userMentions
        };
        if (this.files) ret.files = JSON.stringify(this.files);
        if (this.folders) ret.folders = JSON.stringify(this.folders);
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
         * @type {Contact}
         */
        this.sender = contactStore.getContact(this.owner);
        /**
         * @type {string}
         */
        this.text = payload.text;

        /**
         * @type {Object=}
         */
        this.richText = payload.richText;

        /**
         * For system messages like chat rename fact.
         * @type {Object}
         */
        this.systemData = payload.systemData;
        /**
         * @type {Date}
         */
        this.timestamp = new Date(payload.timestamp);
        this.userMentions = payload.userMentions;
        /**
         * @type {Array<string>}
         */
        this.files = payload.files ? JSON.parse(payload.files) : null;
        this.folders = payload.folders ? JSON.parse(payload.folders) : null;
        /**
         * Does this message mention current user.
         * @type {boolean}
         */
        this.isMention = this.userMentions
            ? this.userMentions.includes(User.current.username)
            : false;
    }

    serializeProps() {
        const ret = {};
        // for future server notifications
        if (this.systemData) ret.systemAction = this.systemData.action;
        return ret;
    }

    deserializeProps() {
        // files are in props only for search
    }
}

module.exports = Message;
