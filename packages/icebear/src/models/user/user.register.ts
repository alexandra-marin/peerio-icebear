import * as keys from '../../crypto/keys';
import * as publicCrypto from '../../crypto/public';
import * as signCrypto from '../../crypto/sign';
import socket from '../../network/socket';
import * as util from '../../util';
import config from '../../config';
import User from './user';
import { AccountCreationChallenge, AccountCreationChallengeConverted } from '../../defs/interfaces';

//
// Registration mixin for User model.
//
export default function mixUserRegisterModule(this: User) {
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
                    sdkVersion: config.sdkVersion,
                    props: this.props || {},
                    appLabel: 'peerio'
                };
                if (config.whiteLabel && config.whiteLabel.name) {
                    request.appLabel = config.whiteLabel.name;
                }
                return socket.send('/noauth/register', request);
            })
            .then(this._handleAccountCreationChallenge);
    };

    this._handleAccountCreationChallenge = (receivedChallenge: AccountCreationChallenge) => {
        console.log('Processing account creation challenge.');
        // validating challenge, paranoid mode on
        if (
            typeof receivedChallenge.username !== 'string' ||
            !(receivedChallenge.ephemeralServerPK instanceof ArrayBuffer) ||
            !(receivedChallenge.signingKey.token instanceof ArrayBuffer) ||
            !(receivedChallenge.authKey.token instanceof ArrayBuffer) ||
            !(receivedChallenge.authKey.nonce instanceof ArrayBuffer) ||
            !(receivedChallenge.encryptionKey.token instanceof ArrayBuffer) ||
            !(receivedChallenge.encryptionKey.nonce instanceof ArrayBuffer)
        ) {
            throw new Error('Invalid account creation challenge received from server');
        }

        const convertedChallenge = util.convertBuffers(
            receivedChallenge
        ) as AccountCreationChallengeConverted;

        if (convertedChallenge.username !== this.username) {
            return Promise.reject(
                new Error('User.username and account creation challenge username do not match.')
            );
        }

        const activationRequest = {
            username: this.username,
            auth: {
                token: publicCrypto.decryptCompat(
                    convertedChallenge.authKey.token,
                    convertedChallenge.authKey.nonce,
                    convertedChallenge.ephemeralServerPK,
                    this.authKeys.secretKey
                ).buffer
            },
            encryption: {
                token: publicCrypto.decryptCompat(
                    convertedChallenge.encryptionKey.token,
                    convertedChallenge.encryptionKey.nonce,
                    convertedChallenge.ephemeralServerPK,
                    this.encryptionKeys.secretKey
                ).buffer
            },
            signing: {
                token: convertedChallenge.signingKey.token.buffer,
                signature: null // to be filled in promise below
            }
        };

        return signCrypto
            .signDetached(convertedChallenge.signingKey.token, this.signKeys.secretKey)
            .then(signature => {
                activationRequest.signing.signature = signature.buffer;
            })
            .then(() => socket.send('/noauth/activate', activationRequest));
    };
}
