const socket = require('../../network/socket');
const warnings = require('../warnings');
const clientApp = require('../client-app');
const TinyDb = require('../../db/tiny-db');
const { cryptoUtil } = require('../../crypto/index');

module.exports = function mixUser2faModule() {
    /**
     * Starts 2fa setup challenge.
     * @returns {Promise<string>} - TOTP secret
     * @memberof User
     * @instance
     * @public
     */
    this.setup2fa = () => {
        console.log('Starting 2fa setup.');
        if (this.twoFAEnabled) return Promise.reject(new Error('2fa already enabled on this account.'));
        return socket.send('/auth/2fa/enable')
            .then(res => {
                return res.TOTPSecret;
            });
    };

    /**
     * Finishes 2fa setup challenge
     * @param {string} code
     * @param {boolean} trust - wether or not to trust this device and minimize 2fa requests on login
     * @returns {Promise<Array<string>>} backup codes
     * @memberof User
     * @instance
     * @public
     */
    this.confirm2faSetup = (code, trust = false) => {
        code = sanitizeCode(code); //eslint-disable-line
        console.log('Confirming 2fa setup.');
        return socket.send('/auth/2fa/confirm', {
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
     * @memberof User
     * @instance
     * @public
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
     * @memberof User
     * @instance
     * @public
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
     * When server returns 2fa error (requests 2fa) on login, this function is called from the login handler
     * to perform 2fa.
     */
    this._handle2faOnLogin = () => {
        return new Promise((resolve, reject) => {
            clientApp.create2FARequest(
                'login',
                (code, trustDevice = false) => {
                    code = sanitizeCode(code); //eslint-disable-line
                    const req = {
                        [code.length === 6 ? 'TOTPCode' : 'backupCode']: code,
                        trustDevice
                    };
                    socket.send('/noauth/2fa/authenticate', req)
                        .then(resp => {
                            return TinyDb.system.setValue(
                                `${this.username}:deviceToken`,
                                cryptoUtil.bytesToB64(resp.deviceToken)
                            );
                        })
                        .then(resolve)
                        .catch(reject);
                }
            );
        });
    };

    function verifyProtectedAction(type) {
        return new Promise((resolve, reject) => {
            clientApp.create2FARequest(
                type,
                (code) => {
                    code = sanitizeCode(code); //eslint-disable-line
                    const req = { [code.length === 6 ? 'TOTPCode' : 'backupCode']: code };
                    socket.send('/auth/2fa/verify', req)
                        .then(resolve)
                        .catch(reject);
                },
                () => {
                    console.log('User cancelled protected 2fa operation:', type);
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
