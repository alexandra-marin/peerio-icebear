import { serverErrorCodes, normalize, NoPasscodeFoundError } from '../../errors';
import socket from '../../network/socket';
import * as keys from '../../crypto/keys';
import * as publicCrypto from '../../crypto/public';
import * as secret from '../../crypto/secret';
import * as cryptoUtil from '../../crypto/util';
import * as util from '../../util';
import TinyDb from '../../db/tiny-db';
import config from '../../config';
import warnings from '../warnings';
import clientApp from '../client-app';
import User from '~/models/user/user';
import { AuthToken, AuthData } from '~/defs/interfaces';
//
// Authentication mixin for User model.
// TODO: authentication code is a bit hard to read and follow, needs refactoring
//
export default function mixUserAuthModule(this: User) {
    this._authenticateConnection = (): Promise<void> => {
        console.log('Starting connection auth sequence.');
        return this._loadAuthSalt()
            .then(this._deriveKeys)
            .then(this._getAuthToken)
            .then(this._authenticateAuthToken)
            .catch(e => {
                // eslint-disable-next-line default-case
                switch (e.code) {
                    case serverErrorCodes.sdkVersionDeprecated:
                    case serverErrorCodes.clientVersionDeprecated:
                        clientApp.clientVersionDeprecated = true;
                        break;
                    case serverErrorCodes.twoFAAuthRequired:
                        console.log('Server requested 2fa on login.');
                        return this._handle2faOnLogin()
                            .catch(err => {
                                if (err && err.code === serverErrorCodes.invalid2FACode) {
                                    warnings.add('error_invalid2faCode');
                                    return Promise.resolve();
                                }
                                return Promise.reject(err);
                            })
                            .then(this._authenticateConnection);
                }
                return Promise.reject(e);
            })
            .then(() => {
                socket.preauthenticated = true;
            });
    };

    this._deriveKeys = () => {
        if (!this.username) return Promise.reject(new Error('Username is required to derive keys'));
        if (!this.passphrase)
            return Promise.reject(new Error('Passphrase is required to derive keys'));
        if (!this.authSalt) return Promise.reject(new Error('Salt is required to derive keys'));
        if (this.bootKey && this.authKeys) return Promise.resolve();
        return keys
            .deriveAccountKeys(this.username, this.passphrase, this.authSalt)
            .then(keySet => {
                this.bootKey = keySet.bootKey;
                this.authKeys = keySet.authKeyPair;
            }) as Promise<void>;
    };

    this._loadAuthSalt = () => {
        console.log('Loading auth salt');
        if (this.authSalt) return Promise.resolve();
        return socket
            .send('/noauth/auth-salt/get', { username: this.username }, false)
            .then(response => {
                this.authSalt = new Uint8Array(response.authSalt);
            }) as Promise<void>;
    };
    this._getAuthToken = () => {
        console.log('Requesting auth token.');
        return Promise.all([this._getDeviceId(), this._get2faCookieData()])
            .then(([deviceId, cookieData]) => {
                const req = {
                    username: this.username,
                    authSalt: this.authSalt.buffer,
                    authPublicKeyHash: keys.getAuthKeyHash(this.authKeys.publicKey).buffer,
                    platform: config.platform,
                    arch: config.arch,
                    clientVersion: config.appVersion,
                    sdkVersion: config.sdkVersion,
                    // sending whatever string in the beginning to let server know we are
                    // a new, cool client which is gonna use sessions
                    sessionId: this.sessionId || 'initialize',
                    appLabel: '',
                    deviceId: '',
                    twoFACookie: ''
                };
                if (config.whiteLabel && config.whiteLabel.name) {
                    req.appLabel = config.whiteLabel.name;
                }
                if (deviceId) {
                    req.deviceId = deviceId;
                }
                if (cookieData && cookieData.cookie) {
                    this.trustedDevice = cookieData.trusted;
                    req.twoFACookie = cookieData.cookie;
                }
                return socket.send('/noauth/auth-token/get', req, true);
            })
            .then(resp => util.convertBuffers(resp)) as Promise<AuthToken>;
    };

    this._authenticateAuthToken = data => {
        console.log('Sending auth token back.');
        const decrypted = publicCrypto.decryptCompat(
            data.token,
            data.nonce,
            data.ephemeralServerPK,
            this.authKeys.secretKey
        );
        // 65 84 = 'AT' (access token)
        if (decrypted[0] !== 65 || decrypted[1] !== 84 || decrypted.length !== 32) {
            throw new Error('Auth token plaintext is of invalid format.');
        }
        return socket
            .send('/noauth/authenticate', { decryptedAuthToken: decrypted.buffer }, true)
            .then(resp => {
                if (this.sessionId && resp.sessionId !== this.sessionId) {
                    console.log('Digest session has expired.');
                    clientApp.clientSessionExpired = true;
                    throw new Error('Digest session was expired, application restart is needed.');
                }
                this.sessionId = resp.sessionId;
            });
    };

    this._checkForPasscode = async (skipCache = false): Promise<boolean> => {
        if (!skipCache && this.authKeys) {
            console.log('user.auth.js: auth keys already loaded');
            return true;
        }
        return TinyDb.system
            .getValue(`${this.username}:passcode`)
            .then(passcodeSecretArray => {
                if (passcodeSecretArray) {
                    return cryptoUtil.b64ToBytes(passcodeSecretArray);
                }
                throw new NoPasscodeFoundError();
            })
            .then(passcodeSecret => {
                this.passcodeIsSet = true;
                if (passcodeSecret) {
                    // will be wiped after first login
                    return this._derivePassphraseFromPasscode(passcodeSecret);
                }
                return false;
            })
            .catch(err => {
                if (err && err.name === 'NoPasscodeFoundError') {
                    console.log(err.message);
                    return;
                }
                console.log(normalize(err));
            });
    };

    //
    // Derive a passphrase and set it for future authentications (only called if applicable on first login).
    // Won't throw if the passcode is incorrect -- login will proceed treating the same user input
    // as a passphrase instead of a passcode, allowing users who have a passcode set to still
    // use their passphrases.
    //
    this._derivePassphraseFromPasscode = (passcodeSecret: Uint8Array): Promise<void> => {
        console.log('Deriving passphrase from passcode.');
        return this._getAuthDataFromPasscode(this.passphrase, passcodeSecret)
            .then(this.deserializeAuthData)
            .catch(() => {
                console.log(
                    'Deriving passphrase from passcode failed, ' +
                        'will ignore and retry login with passphrase'
                );
            });
    };

    this._getAuthDataFromPasscode = (passcode: string, passcodeSecret: Uint8Array) => {
        return keys
            .deriveKeyFromPasscode(this.username, passcode)
            .then(passcodeKey => secret.decryptString(passcodeSecret, passcodeKey))
            .then(authDataJSON => JSON.parse(authDataJSON)) as Promise<AuthData>;
    };

    /**
     * Creates an object with key authentication data that can be used for login
     * with minimal time waste on key derivation.
     * You can use this to store auth data locally in keychain or protected with shorter password.
     */
    this.serializeAuthData = () => {
        const paddedPassphrase = cryptoUtil.padPassphrase(this.passphrase);
        const authSalt = cryptoUtil.bytesToB64(this.authSalt);
        const bootKey = cryptoUtil.bytesToB64(this.bootKey);
        const secretKey = cryptoUtil.bytesToB64(this.authKeys.secretKey);
        const publicKey = cryptoUtil.bytesToB64(this.authKeys.publicKey);
        const data = JSON.stringify({
            username: this.username,
            paddedPassphrase,
            authSalt,
            bootKey,
            authKeys: { secretKey, publicKey }
        });
        return data;
    };
    /**
     * Applies serialized auth data to user object. Just call `login()` after this and user will get authenticated
     * faster then when you just provide username and passphrase.
     */
    this.deserializeAuthData = (data: AuthData): void => {
        // console.log(data);
        const { username, authSalt, bootKey, authKeys } = data;
        this.username = username;
        if (data.paddedPassphrase) {
            this.passphrase = cryptoUtil.unpadPassphrase(data.paddedPassphrase);
        } else {
            // Compatibility with old versions that didn't pad passhprase.
            this.passphrase = data.passphrase;
        }
        this.authSalt = authSalt && cryptoUtil.b64ToBytes(authSalt);
        this.bootKey = bootKey && cryptoUtil.b64ToBytes(bootKey);
        if (authKeys) {
            const { secretKey, publicKey } = authKeys;
            const binSecretKey = secretKey ? cryptoUtil.b64ToBytes(secretKey) : null;
            const binPublicKey = publicKey ? cryptoUtil.b64ToBytes(publicKey) : null;
            if (secretKey && publicKey) {
                this.authKeys = { secretKey: binSecretKey, publicKey: binPublicKey };
            }
        }
    };

    /**
     * Removes passcode for a user if it exists, and disables using passcodes.
     */
    this.disablePasscode = () => {
        return TinyDb.system.setValue(`${this.username}:passcode:disabled`, true).then(() => {
            return TinyDb.system.removeValue(`${this.username}:passcode`).catch((err: Error) => {
                if (err.message !== 'Invalid tinydb key') {
                    throw err;
                }
            });
        });
    };

    /**
     * Checks if user disabled passcode.
     */
    this.passcodeIsDisabled = (): Promise<boolean> => {
        return TinyDb.system.getValue(`${this.username}:passcode:disabled`).catch(() => false);
    };

    /**
     * Given a passcode and a populated User model, gets a passcode-encrypted
     * secret containing the username and passphrase as a JSON string and stores
     * it to the local db.
     */
    this.setPasscode = async (passcode: string) => {
        if (!this.username) throw new Error('Username is required to derive keys');
        if (!this.passphrase) throw new Error('Passphrase is required to derive keys');
        console.log('Setting passcode');
        return keys
            .deriveKeyFromPasscode(this.username, passcode)
            .then(passcodeKey => {
                return secret.encryptString(this.serializeAuthData(), passcodeKey);
            })
            .then(passcodeSecretU8 => {
                this.passcodeIsSet = true;
                return TinyDb.system.setValue(
                    `${this.username}:passcode`,
                    cryptoUtil.bytesToB64(passcodeSecretU8)
                );
            })
            .then(() => {
                // if the user had previously disabled passcodes, remove the pref
                return TinyDb.system
                    .removeValue(`${this.username}:passcode:disabled`)
                    .catch(err => {
                        if (err.message !== 'Invalid tinydb key') {
                            throw err;
                        }
                    });
            });
    };

    /**
     * Validates passcode.
     */
    this.validatePasscode = (passcode: string): Promise<string> => {
        // creating temporary user obj to do that without affecting current instance's state
        const u = new (this.constructor as typeof User)();
        u.passphrase = passcode;
        u.username = this.username;
        return u._checkForPasscode().then(() => {
            if (u.passphrase && u.passphrase !== passcode) return u.passphrase;
            throw new Error('user.auth.js: passcode is not valid');
        });
    };

    /**
     * Checks if user has a passcode saved.
     */
    this.hasPasscode = (): Promise<boolean> => {
        return TinyDb.system.getValue(`${this.username}:passcode`).then(result => !!result);
    };

    /**
     * Call from client app when user specifically chooses to signout.
     * This will positively effect 2fa security.
     *
     * @param untrust - if true, no longer trust the device
     */
    this.signout = (untrust = false) => {
        // On untrusted devices, during logout we remove
        // the 2fa cookie, so that the next sign in will
        // require 2fa.
        //
        // On trusted devices, we preserve the cookie,
        // thus users won't be asked for 2fa code again.
        return Promise.resolve()
            .then(() => {
                if (!this.trustedDevice || untrust) {
                    this.trustedDevice = false;
                    return this._delete2faCookieData();
                }
                return undefined; // for eslint
            })
            .catch(err => {
                // Failed to delete cookie, just log error
                // and continue with server call. If server
                // call succeeds, it will remove its copy of
                // the cookie, invalidating ours.
                console.error(err);
            })
            .then(() => {
                return socket
                    .send('/auth/signout')
                    .timeout(3000)
                    .catch(err => {
                        // Not a show stopper.
                        // If on untrusted device we removed our 2fa cookie
                        // successfully, it will invalidate 2fa session,
                        // so that the next sign it will require 2fa even
                        // if server still has the cookie.
                        //
                        // If both cookie removal and server call failed,
                        // the user won't be asked for 2fa code during the
                        // next sign it even on untrusted device.
                        // But that's the best we could do.
                        console.error(err);
                    });
            });
    };
}
