const { observable, computed, action } = require('mobx');
const moment = require('moment');
const Keg = require('../kegs/keg');
const { cryptoUtil } = require('../../crypto/index');
const User = require('../user/user');
const PhraseDictionary = require('../phrase-dictionary');
const config = require('../../config');
const defaultClock = require('../../helpers/observable-clock').default;
const ghostAPI = require('./ghost.api'); // most of the ghost-specific logic is in here

class Ghost extends Keg {
    DEFAULT_GHOST_LIFESPAN = 259200; // 3 days
    DEFAULT_GHOST_PASSPHRASE_LENGTH = 5;

    @observable sending = false;
    @observable sendError = false;
    @observable subject = '';
    @observable.shallow recipients = [];
    @observable.shallow files = [];
    @observable passphrase = '';
    @observable timestamp = Date.now();
    @observable sent = false;
    @observable lifeSpanInSeconds = 0;
    @observable revoked = false;
    @observable body = '';

    @computed
    get date() {
        return moment(this.timestamp);
    }

    @computed
    get preview() {
        return this.body && this.body.length > 0
            ? this.body
                  .substring(0, 120)
                  .replace(/^[\r\n]*/g, '')
                  .replace(/\r*\n/g, ' ')
            : '...';
    }

    @computed
    get url() {
        return `${config.ghostFrontendUrl}/?${this.ghostId}`;
    }

    @computed
    get expiryDate() {
        return new Date(this.timestamp + this.lifeSpanInSeconds * 1000);
    }

    @computed
    get fileCounter() {
        return this.files.length;
    }

    @computed
    get expired() {
        return (
            this.timestamp + this.lifeSpanInSeconds * 1000 < defaultClock.now
        );
    }

    get ephemeralKeypair() {
        return this.keypair;
    }

    set ephemeralKeypair(kp) {
        this.keypair = kp;
    }

    /*
     * Constructor.
     *
     * NOTE: ghost IDs are in hex for browser compatibility.
     */
    constructor(db) {
        super(null, 'ghost', db);
        this.revoke = this.revoke.bind(this);
        this.version = 2;
        this.passphrase = PhraseDictionary.current.getPassphrase(
            this.DEFAULT_GHOST_PASSPHRASE_LENGTH
        );
        // encode user-specific ID in hex
        this.ghostId = cryptoUtil.getRandomUserSpecificIdHex(
            User.current.username
        );
    }

    /*
     * ghost id
     * @returns {{ghostId: (String|*)}}
     */
    serializeProps() {
        return { ghostId: this.ghostId };
    }

    /*
     * To be saved to kegs.
     *
     * @returns {Object}
     */
    serializeKegPayload() {
        return {
            subject: this.subject,
            passphrase: this.passphrase,
            recipients: this.recipients.slice(),
            lifeSpanInSeconds: this.lifeSpanInSeconds,
            version: 2,
            files: this.files.slice(),
            body: this.body,
            timestamp: this.timestamp,
            revoked: this.revoked
        };
    }

    @action
    deserializeProps(props) {
        this.ghostId = props.ghostId;
    }

    /*
     * Load existing (sent) ghost from keg storage.
     *
     * @param {Object} data
     */
    @action
    deserializeKegPayload(data) {
        this.body = data.body;
        this.subject = data.subject;
        this.passphrase = data.passphrase;
        this.files = data.files;
        this.timestamp = data.timestamp;
        this.recipients = data.recipients;
        this.sent = true;
        this.lifeSpanInSeconds = data.lifeSpanInSeconds;
        this.revoked = data.revoked;
    }

    /*
     * Send a ghost.
     *
     * @param {string} text - message content
     */
    send(text) {
        this.sending = true;
        this.body = text;
        this.timestamp = Date.now();
        this.lifeSpanInSeconds = this.DEFAULT_GHOST_LIFESPAN;

        return ghostAPI
            .deriveKeys(this)
            .then(() => ghostAPI.serialize(this, User.current))
            .then(serializedGhost =>
                ghostAPI.encrypt(this, User.current, serializedGhost)
            )
            .then(res => ghostAPI.send(this, res))
            .then(() => this.saveToServer())
            .then(() => {
                this.sent = true;
            })
            .catch(err => {
                this.sendError = true;
                console.error('Error sending ghost', err);
                return Promise.reject(err);
            })
            .finally(() => {
                this.sending = false;
            });
    }

    /*
     * Attaches files.
     *
     * @param {Array<File>} files
     */
    attachFiles(files) {
        this.files.clear();
        if (!files || !files.length) return null;
        files.forEach(file => {
            this.files.push(file.fileId);
        });
        return files.slice();
    }

    /*
     * Destroy the public-facing ghost.
     * @returns {Promise}
     */
    revoke() {
        return ghostAPI.revoke(this).then(() => this.saveToServer());
    }
}

module.exports = Ghost;
