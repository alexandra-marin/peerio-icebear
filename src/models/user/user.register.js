const keys = require('../../crypto/keys');
const publicCrypto = require('../../crypto/public');
const signCrypto = require('../../crypto/sign');
const socket = require('../../network/socket');
const util = require('../../util');
const config = require('../../config');

//
// Registration mixin for User model.
//
module.exports = function mixUserRegisterModule() {
    this._createAccount = () => {
        console.log('Generating keys.');
        this.authSalt = keys.generateAuthSalt();
        this.signKeys = keys.generateSigningKeyPair();
        this.encryptionKeys = keys.generateEncryptionKeyPair();
        this.kegKey = keys.generateEncryptionKey();

        return this._deriveKeys()
            .then(() => {
                const request = {
                    authPublicKey: this.authKeys.publicKey.buffer,
                    signingPublicKey: this.signKeys.publicKey.buffer,
                    encryptionPublicKey: this.encryptionKeys.publicKey.buffer,
                    authSalt: this.authSalt.buffer,
                    username: this.username.trim(),
                    email: this.email.trim(),
                    firstName: this.firstName.trim() || '',
                    lastName: this.lastName.trim() || '',
                    localeCode: this.locale.trim(),
                    platform: config.platform,
                    clientVersion: config.appVersion,
                    sdkVersion: config.sdkVersion // ,
                    // appLabel: config.appLabel

                };
                return socket.send('/noauth/register', request);
            })
            .then(this._handleAccountCreationChallenge);
    };

    this._handleAccountCreationChallenge = (cng) => {
        console.log('Processing account creation challenge.');
        // validating challenge, paranoid mode on
        if (typeof (cng.username) !== 'string'
            || !(cng.ephemeralServerPK instanceof ArrayBuffer)
            || !(cng.signingKey.token instanceof ArrayBuffer)
            || !(cng.authKey.token instanceof ArrayBuffer)
            || !(cng.authKey.nonce instanceof ArrayBuffer)
            || !(cng.encryptionKey.token instanceof ArrayBuffer)
            || !(cng.encryptionKey.nonce instanceof ArrayBuffer)
        ) {
            throw new Error('Invalid account creation challenge received from server', cng);
        }

        util.convertBuffers(cng);

        if (cng.username !== this.username) {
            return Promise.reject(new Error('User.username and account creation challenge username do not match.'));
        }

        const activationRequest = {
            username: this.username,
            auth: {
                token: publicCrypto.decryptCompat(
                    cng.authKey.token,
                    cng.authKey.nonce,
                    cng.ephemeralServerPK,
                    this.authKeys.secretKey
                ).buffer
            },
            encryption: {
                token: publicCrypto.decryptCompat(
                    cng.encryptionKey.token,
                    cng.encryptionKey.nonce,
                    cng.ephemeralServerPK,
                    this.encryptionKeys.secretKey
                ).buffer
            },
            signing: {
                token: cng.signingKey.token.buffer,
                signature: null // to be filled in promise below
            }
        };

        return signCrypto.signDetached(cng.signingKey.token, this.signKeys.secretKey)
            .then(signature => { activationRequest.signing.signature = signature.buffer; })
            .then(() => socket.send('/noauth/activate', activationRequest));
    };
};
