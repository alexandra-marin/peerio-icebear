/*
 Calls involving the non-kegs API of ghost and
 corresponding asymmetric encryption
 */
const _ = require('lodash');
const { cryptoUtil, sign, secret } = require('../../crypto/index');
const keys = require('../../crypto/keys');
const socket = require('../../network/socket');
const fileStore = require('../files/file-store');

const ghostAPI = {};

/*
 * Derive ephemeral keys.
 * Mutates1 ghost -- adds keypair.
 *
 * @param {Ghost} ghost
 * @returns {Promise}
 */
ghostAPI.deriveKeys = function(ghost) {
    return keys.deriveEphemeralKeys(cryptoUtil.hexToBytes(ghost.ghostId), ghost.passphrase)
        .then((kp) => {
            ghost.ephemeralKeypair = kp;
        });
};

/*
 * to be sent to ephemeral recipient, encrypted asymmetrically
 *
 * @param {Ghost} ghost
 * @param {User} user
 * @returns {Promise<Object>}
 */
ghostAPI.serialize = function(ghost, user) {
    return Promise.resolve({
        subject: ghost.subject,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        ghostId: ghost.ghostId,
        lifeSpanInSeconds: ghost.lifeSpanInSeconds,
        signingPublicKey: cryptoUtil.bytesToB64(user.signKeys.publicKey),
        version: 2,
        body: ghost.body,
        files: _.map(ghost.files, (fileId) => {
            const file = fileStore.getById(fileId);
            return _.assign({}, file.serializeProps(), file.serializeKegPayload());
        }),
        timestamp: ghost.timestamp
    });
};


/*
 * Encrypt for the ephemeral keypair and signs the ciphertext.
 *
 * @param {Ghost} ghost
 * @param {User} user
 * @returns {Promise<Object body:Uint8Array signature:String >}
 */
ghostAPI.encrypt = function(ghost, user, serializedGhost) {
    const res = {};
    try {
        const body = JSON.stringify(serializedGhost);
        res.body = secret.encryptString(
            body,
            user.getSharedKey(ghost.ephemeralKeypair.publicKey)
        );
        return sign.signDetached(res.body, user.signKeys.secretKey)
            .then(cryptoUtil.bytesToB64)
            .then(signature => {
                res.signature = signature;
                return res;
            });
    } catch (e) {
        return Promise.reject(e);
    }
};

/*
 * Use ghost API to send ghost to external/ephemeral recipients.
 *
 * @param {Ghost} ghost
 * @param {Object} asymEncryptionRes
 * @param {string} asymEncryptionRes.signature (base64)
 * @param {Uint8Array} asymEncryptionRes.body
 * @returns {Promise}
 */
ghostAPI.send = function(ghost, asymEncryptionRes) {
    return socket.send('/auth/ghost/send', {
        ghostId: ghost.ghostId,
        signature: asymEncryptionRes.signature,
        ghostPublicKey: ghost.ephemeralKeypair.publicKey.buffer,
        recipients: ghost.recipients.slice(),
        lifeSpanInSeconds: ghost.lifeSpanInSeconds,
        version: ghost.version,
        files: ghost.files.slice(),
        body: asymEncryptionRes.body.buffer
    });
};

/*
 * Destroy the public-facing ghost.
 * @returns {Promise}
 */
ghostAPI.revoke = function(ghost) {
    return socket.send('/auth/ghost/delete', { ghostId: ghost.ghostId })
        .then(() => {
            ghost.revoked = true;
        });
};

module.exports = ghostAPI;
