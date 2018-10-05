// @ts-check
import { requestDownloadPath } from '~/helpers/file';
const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const {
    Button,
    Dialog,
    MaterialIcon,
    Switch,
    ProgressBar
} = require('peer-ui');
const { User, saveAccountKeyBackup } = require('peerio-icebear');
const { t } = require('peerio-translator');
const autologin = require('~/helpers/autologin');
const electron = require('electron').remote;
const T = require('~/ui/shared-components/T');
const QR = require('qrcode');
const BetterInput = require('~/ui/shared-components/BetterInput');
const css = require('classnames');
const fs = require('fs');

@observer
export default class SecuritySettings extends React.Component {
    @observable passphraseVisible = false;
    @observable twoFASecret = null;
    @observable twoFAQRCode = null;
    @observable qrCodeVisible = true; // when false - secret key is visible instead
    @observable totpCode = '';
    @observable totpCodeValidating = false;
    @observable authAppsDialogActive = false;

    componentWillMount() {
        // todo: refresh in 2 hours?
        if (!User.current.twoFAEnabled) {
            this.requestSetup();
        }
    }
    requestSetup = () => {
        User.current.setup2fa().then(secret => {
            this.twoFASecret = secret;
            QR.toDataURL(
                // eslint-disable-next-line
                `otpauth://totp/Peerio:${
                    User.current.username
                }?secret=${secret}&issuer=Peerio&algorithm=SHA1&digits=6&period=30`,
                (err, dataUrl) => {
                    if (err) console.error(err);
                    this.twoFAQRCode = dataUrl;
                }
            );
        });
    };

    togglePassphraseVisibility = () => {
        this.passphraseVisible = !this.passphraseVisible;
    };

    backupAccountKey = async () => {
        let path = '';
        try {
            path = await requestDownloadPath(
                `${User.current.username}-${t('title_appName')}.pdf`
            );
        } catch (err) {
            // user cancel
        }

        if (path) {
            saveAccountKeyBackup(
                path,
                User.current.fullName,
                User.current.username,
                User.current.passphrase
            );
            User.current.setAccountKeyBackedUp();
        }
    };

    onToggleAutologin(ev) {
        ev.target.checked ? autologin.enable() : autologin.disable();
    }

    toggleQRCode = () => {
        this.qrCodeVisible = !this.qrCodeVisible;
        this.totpCodeError = false;
    };

    onTOTPCodeChange = value => {
        this.totpCode = value;
        this.totpCodeError = false;
        if (this.totpCode.replace(/\s+/g, '').length >= 6) {
            this.totpCodeValidating = true;
            User.current
                .confirm2faSetup(this.totpCode, false)
                .then(backupCodes => {
                    this.backupCodes = backupCodes;
                })
                .catch(() => {
                    this.totpCodeError = true;
                    this.totpCode = '';
                })
                .finally(() => {
                    this.totpCodeValidating = false;
                });
        }
    };

    downloadBackupCodes = () => {
        if (!this.backupCodes) {
            User.current.reissueBackupCodes().then(codes => {
                this.backupCodes = codes;
                this.downloadBackupCodes();
            });
            return;
        }
        const txtContents = this.backupCodes.join('\n\r');
        const win = electron.getCurrentWindow();
        electron.dialog.showSaveDialog(
            win,
            { defaultPath: `${User.current.username}_2fa_backup.txt` },
            fileSavePath => {
                if (fileSavePath) {
                    fs.writeFileSync(fileSavePath, txtContents);
                }
            }
        );
    };

    disable2fa = () => {
        User.current.disable2fa().then(this.requestSetup);
    };
    openAuthApps = () => {
        this.authAppsDialogActive = true;
    };
    closeAuthApps = () => {
        this.authAppsDialogActive = false;
    };
    copyTOTPSecret = () => {
        electron.clipboard.writeText(this.twoFASecret);
    };
    renderAccountKeySection() {
        return (
            <section className="with-bg">
                <T k="title_AccountKey" tag="div" className="title" />
                <T k="title_AKDetail" tag="p" />
                <div className="account-key-toggle">
                    {this.passphraseVisible ? (
                        <span className="selectable monospace">
                            {User.current.passphrase}
                        </span>
                    ) : (
                        <span>••••••••••••••••••••••••••••••••••••••••••</span>
                    )}&nbsp;&nbsp;
                    <Button
                        icon="visibility"
                        tooltip={
                            this.passphraseVisible
                                ? t('title_hideAccountKey')
                                : t('title_showAccountKey')
                        }
                        tooltipPosition="right"
                        onClick={this.togglePassphraseVisibility}
                        selected={this.passphraseVisible}
                        theme="no-hover"
                    />
                    <Button
                        icon="file_download"
                        className="save-button"
                        label={t('button_saveAccountKey')}
                        onClick={this.backupAccountKey}
                        theme="primary"
                    />
                </div>
            </section>
        );
    }

    renderAutologinSection() {
        return (
            <section className="with-bg">
                <T
                    k="title_securityDeviceSettings"
                    tag="div"
                    className="title"
                />
                <T k="title_securityDeviceSettingsDetail" tag="p" />
                <Switch
                    checked={User.current.autologinEnabled}
                    label={t('title_autologinSetting')}
                    onChange={this.onToggleAutologin}
                />
            </section>
        );
    }

    render2faSetupSection() {
        return (
            <section className="with-bg">
                <T k="title_2FA" className="title" tag="div" />
                <p>
                    <T k="title_2FADetailDesktop" />
                    <a onClick={this.openAuthApps}>
                        <Button
                            icon="help"
                            tooltip={t('title_readMore')}
                            theme="no-hover"
                        />
                    </a>
                    <Dialog
                        active={this.authAppsDialogActive}
                        title={t('title_authApps')}
                        onCancel={this.closeAuthApps}
                        actions={[
                            {
                                label: t('button_close'),
                                onClick: this.closeAuthApps
                            }
                        ]}
                    >
                        <T k="title_authAppsDetails" tag="p" />
                    </Dialog>
                </p>
                <div className="twofa-container">
                    <div className="qr-code">
                        <T k="title_step1" className="bold" />
                        {this.twoFAQRCode ? (
                            this.qrCodeVisible ? (
                                <div>
                                    <T k="title_scanQRCode" tag="div" />
                                    <br />
                                    <img
                                        alt={this.twoFASecret}
                                        src={this.twoFAQRCode}
                                    />
                                    <a onClick={this.toggleQRCode}>
                                        <T
                                            k="button_2FAShowSecret"
                                            tag="div"
                                            className="text-center"
                                        />
                                    </a>
                                </div>
                            ) : (
                                <div>
                                    <T k="title_pasteTOTPKey" tag="div" />
                                    <br />
                                    <T
                                        k="title_2FASecretKey"
                                        className="dark-label"
                                        tag="div"
                                    />

                                    <div className="bold selectable">
                                        {this.twoFASecret}
                                        <Button
                                            icon="content_copy"
                                            onClick={this.copyTOTPSecret}
                                            tooltip={t('title_copy')}
                                            primary
                                        />
                                    </div>
                                    <br />
                                    <a onClick={this.toggleQRCode}>
                                        <T
                                            k="button_2FAShowQRCode"
                                            tag="div"
                                            className="text-center"
                                        />
                                    </a>
                                </div>
                            )
                        ) : (
                            <ProgressBar type="circular" className="block" />
                        )}
                    </div>
                    <div className="totp-code">
                        <T k="title_step2" tag="div" className="bold" />
                        <T k="title_enterTOTPCodeFromApp" tag="div" />
                        <br />
                        <BetterInput
                            label={t('title_enterTOTPCode')}
                            className={css('totp-input', {
                                'totp-error': this.totpCodeError
                            })}
                            value={this.totpCode}
                            onChange={this.onTOTPCodeChange}
                            acceptOnBlur="false"
                        />
                        {this.totpCodeValidating ? (
                            <ProgressBar
                                type="circular"
                                className="totp-progress"
                            />
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    render2faEnabledSection() {
        return (
            <section className="with-bg">
                <T k="title_2FA" className="title" tag="div" />
                <p>
                    <MaterialIcon
                        icon="check_circle"
                        className="icon-affirmative icon-large"
                    />
                    &nbsp;&nbsp;
                    <T k="title_2FAEnabledThanks" />
                </p>
                <T k="title_2FABackupDetail" tag="p" />
                <Button
                    icon="file_download"
                    label={t('button_2FABackupDownload')}
                    onClick={this.downloadBackupCodes}
                    theme="primary"
                />
                <div className="text-right">
                    <Button
                        label={t('button_disable')}
                        onClick={this.disable2fa}
                    />
                </div>
            </section>
        );
    }

    render() {
        window.c = this;
        return (
            <div className="security-settings">
                {this.renderAccountKeySection()}
                {User.current.twoFAEnabled
                    ? this.render2faEnabledSection()
                    : this.render2faSetupSection()}
                {this.renderAutologinSection()}
            </div>
        );
    }
}
