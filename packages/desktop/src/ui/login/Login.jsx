/* eslint-disable jsx-a11y/no-static-element-interactions */
import * as telemetry from '~/telemetry';
const React = require('react');
const { Component } = require('react');
const { Button } = require('peer-ui');
const {
    config,
    socket,
    User,
    validation,
    warnings
} = require('peerio-icebear');
const { observable, computed, when } = require('mobx');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const ValidatedInput = require('~/ui/shared-components/ValidatedInput');
const FullCoverLoader = require('~/ui/shared-components/FullCoverLoader');
const T = require('~/ui/shared-components/T');
const OrderedFormStore = require('~/stores/ordered-form-store');
const css = require('classnames');
const autologin = require('~/helpers/autologin');
const routerStore = require('~/stores/router-store');
const updaterStore = require('~/stores/updater-store');
const uiStore = require('~/stores/ui-store');

const PoweredByLogin = require('~/whitelabel/components/PoweredByLogin');
const SignupLink = require('~/whitelabel/components/SignupLink');

const { validators } = validation; // use common validation from core

class LoginStore extends OrderedFormStore {
    @observable fieldsExpected = 2;

    // also has observables usernameValid, usernameDirty created by ValidatedInput
    @observable username = '';
    @observable passcodeOrPassphrase = '';

    // non ValidatedInput-enhanced observables
    @observable busy = true;
    @observable passwordVisible = false;
    @observable lastAuthenticatedUser = undefined;

    @computed
    get hasErrors() {
        return !(
            this.initialized && // store has its input properties
            this.usernameValid &&
            this.passcodeOrPassphraseValid && // fields ok
            socket.connected
        ); // server is available
    }
}

@observer
class Login extends Component {
    constructor() {
        super();
        this.loginStore = new LoginStore();
    }

    componentDidMount() {
        User.getLastAuthenticated().then(lastUserObject => {
            const dev = config.devAutologin;
            if (dev) {
                setTimeout(() => {
                    this.loginStore.username = dev.username;
                    this.loginStore.passcodeOrPassphrase = dev.passphrase;
                    this.loginStore.busy = false;
                }, 500);
                if (dev.autologin) {
                    setTimeout(() => this.login(true), 1000);
                }
                if (dev.navigateTo) {
                    when(
                        () =>
                            routerStore.currentRoute &&
                            routerStore.currentRoute.startsWith('/app'),
                        () => routerStore.navigateTo(dev.navigateTo)
                    );
                }
                return;
            }
            if (lastUserObject) {
                uiStore.newUserPageOpen = false;
                this.loginStore.lastAuthenticatedUser = lastUserObject;
                this.loginStore.username = lastUserObject.username;
                autologin
                    .getPassphrase(this.loginStore.username)
                    .then(passphrase => {
                        if (!passphrase) {
                            this.loginStore.busy = false;
                            return;
                        }
                        this.loginStore.passcodeOrPassphrase = passphrase;
                        if (updaterStore.lastUpdateFailed) {
                            this.loginStore.busy = false;
                            return;
                        }
                        this.login(true);
                    })
                    .catch(() => {
                        this.loginStore.busy = false;
                    });
            } else {
                this.loginStore.busy = false;
                if (uiStore.newUserPageOpen) {
                    routerStore.navigateTo(routerStore.ROUTES.newUser);
                }
            }
        });

        this.startTime = Date.now();
    }

    componentWillUnmount() {
        if (!uiStore.newUserPageOpen) {
            telemetry.login.duration(this.startTime);
        }
    }

    togglePasswordVisibility = () => {
        this.loginStore.passwordVisible = !this.loginStore.passwordVisible;
        if (this.akRef) this.akRef.inputRef.focus();
        telemetry.login.toggleAkVisibility(this.loginStore.passwordVisible);
    };

    unsetLastUser = () => {
        telemetry.login.changeUser();
        return User.removeLastAuthenticated().then(() => {
            this.loginStore.lastAuthenticatedUser = undefined;
            this.loginStore.username = undefined;
        });
    };

    onLoginClick = () => {
        this.login();
        telemetry.login.onLoginClick();
    };

    login = (isAutologin = false) => {
        if (this.loginStore.busy && !isAutologin) return;
        if (!isAutologin && this.loginStore.hasErrors) return;
        if (isAutologin && !socket.connected) {
            socket.onceConnected(() => this.login(true));
            return;
        }
        this.loginStore.busy = true;
        const user = new User();
        user.username =
            this.loginStore.username ||
            this.loginStore.lastAuthenticatedUser.username;
        user.passphrase = this.loginStore.passcodeOrPassphrase;
        user.autologinEnabled = isAutologin;
        User.current = user;
        user.login()
            .then(() => {
                if (!User.current.autologinEnabled) {
                    return autologin.shouldSuggestEnabling().then(suggest => {
                        if (suggest) {
                            autologin.enable();
                            autologin.dontSuggestEnablingAgain();
                        }
                        routerStore.navigateTo(routerStore.ROUTES.loading);
                    });
                }
                return routerStore.navigateTo(routerStore.ROUTES.loading);
            })
            .catch(() => {
                User.current = null;
                this.loginStore.busy = false;
                let errorMsg = 'error_wrongAK';

                // Error messages in snackbar
                if (user.blacklisted) {
                    errorMsg = 'error_accountSuspendedTitle';
                    warnings.addSevere(
                        'error_accountSuspendedText',
                        'error_accountSuspendedTitle'
                    );
                }
                if (user.deleted) {
                    errorMsg = 'title_accountDeleted';
                    warnings.addSevere('title_accountDeleted');
                }

                // Error message below AK input
                this.loginStore.passcodeOrPassphraseValidationMessageText = t(
                    errorMsg
                );

                telemetry.login.loginFailed();
            });
    };

    handleKeyPress = e => {
        if (e.key === 'Enter') {
            this.login();
        }
    };

    usernameHandleKeyPress = e => {
        if (e.key === '@') {
            telemetry.login.onLoginWithEmail();
        }
        this.handleKeyPress(e);
    };

    onAKRef = ref => {
        this.akRef = ref;
    };

    getWelcomeBlock = () => {
        return (
            <div className="welcome-back" onClick={this.unsetLastUser}>
                <div className="overflow ">
                    {t('title_welcomeBack')}&nbsp;
                    <strong>
                        {this.loginStore.lastAuthenticatedUser.firstName ||
                            this.loginStore.lastAuthenticatedUser.username}
                    </strong>
                </div>
                <div className="subtitle">
                    <div className="overflow">
                        <T k="button_changeUserDesktop">
                            {{
                                username:
                                    this.loginStore.lastAuthenticatedUser
                                        .firstName ||
                                    this.loginStore.lastAuthenticatedUser
                                        .username
                            }}
                        </T>
                    </div>
                </div>
            </div>
        );
    };

    render() {
        return (
            <div className="app-root">
                <FullCoverLoader show={this.loginStore.busy} />
                <div className="login">
                    <img
                        alt="Peerio logo"
                        className="logo"
                        src="static/img/logo-mark.svg"
                    />
                    <PoweredByLogin />
                    <div className="login-inputs-container">
                        {this.loginStore.lastAuthenticatedUser
                            ? this.getWelcomeBlock()
                            : ''}

                        <div className="login-form">
                            <div
                                className={css('title', {
                                    banish: this.loginStore
                                        .lastAuthenticatedUser
                                })}
                            >
                                {t('title_login')}
                            </div>

                            <ValidatedInput
                                label={t('title_username')}
                                name="username"
                                position="0"
                                lowercase="true"
                                store={this.loginStore}
                                validator={validators.usernameLogin}
                                onKeyPress={this.usernameHandleKeyPress}
                                className={css({
                                    banish: this.loginStore
                                        .lastAuthenticatedUser
                                })}
                                theme="dark"
                            />
                            <div className="password">
                                <ValidatedInput
                                    type={
                                        this.loginStore.passwordVisible
                                            ? 'text'
                                            : 'password'
                                    }
                                    label={t('title_AccountKey')}
                                    position="1"
                                    store={this.loginStore}
                                    validator={validators.stringExists}
                                    name="passcodeOrPassphrase"
                                    onKeyPress={this.handleKeyPress}
                                    ref={this.onAKRef}
                                    theme="dark"
                                />
                                <Button
                                    icon="visibility"
                                    active={this.loginStore.passwordVisible}
                                    tooltip={
                                        this.loginStore.passwordVisible
                                            ? t('title_hideAccountKey')
                                            : t('title_showAccountKey')
                                    }
                                    tooltipPosition="right"
                                    onClick={this.togglePasswordVisibility}
                                />
                            </div>
                            {/* <Dropdown value={languageStore.language}
                                  options={languageStore.translationLangsDataSource}
                                  onChange={languageStore.changeLanguage} />
                        */}
                            <div className="login-button-container">
                                <Button
                                    label={t('button_login')}
                                    onClick={this.onLoginClick}
                                    disabled={this.loginStore.hasErrors}
                                    theme="affirmative"
                                />
                            </div>
                        </div>
                    </div>

                    <SignupLink />
                </div>
            </div>
        );
    }
}

module.exports = Login;
