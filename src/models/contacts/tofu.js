const Keg = require('./../kegs/keg');
const { AntiTamperError } = require('../../errors');
const socket = require('../../network/socket');
const { getUser } = require('../../helpers/di-current-user');

/**
 * Tofu keg.
 * @param {KegDb} db
 * @extends {Keg}
 * @public
 */
class Tofu extends Keg {
    constructor(db) {
        super(null, 'tofu', db);
    }

    /**
     * @member {string}
     * @public
     */
    username;
    /**
     * @member {string}
     * @public
     */
    firstName;
    /**
     * @member {string}
     * @public
     */
    lastName;
    /**
     * @member {Uint8Array}
     * @public
     */
    encryptionPublicKey;
    /**
     * @member {Uint8Array}
     * @public
     */
    signingPublicKey;

    static cache = null;

    static preCacheRequests = [];

    serializeKegPayload() {
        return {
            username: this.username,
            firstName: this.firstName,
            lastName: this.lastName,
            encryptionPublicKey: this.encryptionPublicKey,
            signingPublicKey: this.signingPublicKey
        };
    }

    deserializeKegPayload(payload) {
        this.firstName = payload.firstName;
        this.lastName = payload.lastName;
        this.encryptionPublicKey = payload.encryptionPublicKey;
        this.signingPublicKey = payload.signingPublicKey;
    }

    serializeProps() {
        return { username: this.username };
    }

    deserializeProps(props) {
        this.username = props.username;
    }

    detectTampering(payload) {
        super.detectTampering(payload);
        if (payload.username !== this.username) {
            throw new AntiTamperError('Tofu keg inner and outer username mismatch. '
                + `Inner: ${payload.username}. Outer: ${this.username}`);
        }
    }
    /**
     * Finds Tofu keg by username property.
     * @static
     * @param {string} username
     * @returns {Promise<?Tofu>} tofu keg, if any
     * @memberof Tofu
     * @public
     */
    static getByUsername(username) {
        if (!Tofu.cache) {
            return new Promise((resolve, reject) => {
                Tofu.preCacheRequests.push({ username, resolve, reject });
            });
        }

        if (Tofu.cache[username]) return Promise.resolve(Tofu.cache[username]);

        return socket.send('/auth/kegs/db/list-ext', {
            kegDbId: 'SELF',
            options: {
                type: 'tofu',
                reverse: false
            },
            filter: { username }
        }).then(res => {
            if (!res.kegs || !res.kegs.length) return null;
            const keg = new Tofu(getUser().kegDb);
            keg.loadFromKeg(res.kegs[0]); // TODO: detect and delete excess? shouldn't really happen though
            return keg;
        });
    }

    // todo: paging
    static populateCache() {
        if (Tofu.cache) return;
        console.log('Precaching tofu kegs');
        socket.send('/auth/kegs/db/list-ext', {
            kegDbId: 'SELF',
            options: {
                type: 'tofu',
                reverse: false
            }
        }).then(res => {
            Tofu.cache = {};
            if (!res.kegs || !res.kegs.length) {
                return;
            }
            res.kegs.forEach(data => {
                const keg = new Tofu(getUser().kegDb);
                keg.loadFromKeg(data);
                Tofu.cache[keg.username] = keg;
            });

            Tofu.preCacheRequests.forEach(u => {
                u.resolve(Tofu.cache[u.username]);
            });
            Tofu.preCacheRequests = [];
        }).catch(err => {
            console.error(err);
            Tofu.preCacheRequests.forEach(u => {
                u.reject(err);
            });
            Tofu.preCacheRequests = [];
        });
    }
}

socket.onAuthenticated(Tofu.populateCache);

module.exports = Tofu;
