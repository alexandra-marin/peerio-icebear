const socket = require('../../network/socket');
const warnings = require('../warnings');
const clientApp = require('../client-app');
const TinyDb = require('../../db/tiny-db');
const config = require('../../config');
const { cryptoUtil } = require('../../crypto/index');

module.exports = function mixUser2faModule() {
    /**
     * Starts 2fa setup challenge.
     * @returns {Promise<string>} - TOTP secret
     */
    this.setup2fa = () => {
        console.log('Starting 2fa setup.');
        if (this.twoFAEnabled)
            return Promise.reject(
                new Error('2fa already enabled on this account.')
            );
        return socket.send('/auth/2fa/enable').then(res => {
            return res.TOTPSecret;
        });
    };

    /**
     * Finishes 2fa setup challenge
     * @param {string} code
     * @param {boolean} trust - wether or not to trust this device and minimize 2fa requests on login
     * @returns {Promise<Array<string>>} backup codes
     */
    this.confirm2faSetup = (code, trust = false) => {
        // eslint-disable-next-line no-param-reassign
        code = sanitizeCode(code);
        console.log('Confirming 2fa setup.');
        return socket
            .send('/auth/2fa/confirm', {
                TOTPCode: code,
                trustDevice: trust
            })
            .then(res => {
                this.twoFAEnabled = true; // just to speed up UI refresh, actual profile keg reload can take a few sec
                return res.backupCodes;
            })
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_setup2fa');
            });
    };

    /**
     * Disables 2fa on current account.
     * @returns {Promise}
     */
    this.disable2fa = () => {
        return verifyProtectedAction('disable')
            .then(() => socket.send('/2fa/disable'))
            .then(() => {
                this.twoFAEnabled = false; // just to speed up UI refresh
            })
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_disable2fa');
            });
    };

    /**
     * Requests new set of 2fa backup codes invalidating previous ones..
     * @returns {Promise}
     */
    this.reissueBackupCodes = () => {
        return verifyProtectedAction('backupCodes')
            .then(() => socket.send('/2fa/backup-codes/reissue'))
            .then(res => res.backupCodes)
            .tapCatch(err => {
                console.error(err);
                warnings.add('error_reissue2faBackupCodes');
            });
    };

    /**
     * Stores 2fa cookie and device trust in system database.
     * @param {{cookie, trusted}} data
     * @returns {Promise<void>}
     */
    this._set2faCookieData = data => {
        return TinyDb.system.setValue(`${this.username}:twoFACookie`, data);
    };

    /**
     * Retrieves 2fa cookie and device trust from system database.
     * If there's no cookie, returns a promise resolving to undefined.
     * @returns {Promise<{cookie, trusted}|undefined>}
     */
    this._get2faCookieData = () => {
        return TinyDb.system.getValue(`${this.username}:twoFACookie`);
    };

    /**
     * Deletes 2fa cookie from the system database.
     * @returns {Promise<void>}
     */
    this._delete2faCookieData = () => {
        return TinyDb.system.removeValue(`${this.username}:twoFACookie`);
    };

    /**
     * Returns deviceId from system database.
     * If there's no deviceId stored, it generates a new one, stores it, and returns.
     * @returns {Promise<string>}
     */
    this._getDeviceId = () => {
        const key = `${this.username}:deviceId`;
        return TinyDb.system.getValue(key).then(deviceId => {
            // Found it.
            if (deviceId) return deviceId;

            // Not found, generate a new one and save it.
            deviceId = cryptoUtil.getDeviceId(this.username, config.deviceUID); // eslint-disable-line no-param-reassign
            return TinyDb.system.setValue(key, deviceId).return(deviceId);
        });
    };

    /**
     * When server returns 2fa error (requests 2fa) on login, this function is called from the login handler
     * to perform 2fa.
     */
    this._handle2faOnLogin = () => {
        return new Promise((resolve, reject) => {
            clientApp.create2FARequest('login', (code, trustDevice = false) => {
                this._getDeviceId()
                    .then(deviceId => {
                        // eslint-disable-next-line no-param-reassign
                        code = sanitizeCode(code);
                        const req = {
                            username: this.username,
                            deviceId,
                            [code.length === 6
                                ? 'TOTPCode'
                                : 'backupCode']: code,
                            trustDevice
                        };
                        return socket
                            .send('/noauth/2fa/authenticate', req)
                            .then(resp => {
                                if (!resp.twoFACookie) return null;
                                return this._set2faCookieData({
                                    cookie: resp.twoFACookie,
                                    trusted: trustDevice
                                });
                            });
                    })
                    .then(resolve)
                    .catch(reject);
            });
        });
    };

    function verifyProtectedAction(type) {
        return new Promise((resolve, reject) => {
            clientApp.create2FARequest(
                type,
                code => {
                    // eslint-disable-next-line no-param-reassign
                    code = sanitizeCode(code);
                    const req = {
                        [code.length === 6 ? 'TOTPCode' : 'backupCode']: code
                    };
                    socket
                        .send('/auth/2fa/verify', req)
                        .then(resolve)
                        .catch(reject);
                },
                () => {
                    console.log(
                        'User cancelled protected 2fa operation:',
                        type
                    );
                }
            );
        });
    }

    function sanitizeCode(code) {
        let ret = code;
        try {
            ret = ret.toString();
            ret = ret.replace(/\s+/g, '');
            return ret;
        } catch (err) {
            console.error('Error sanitizing 2fa code.', err);
            return ret;
        }
    }
};
