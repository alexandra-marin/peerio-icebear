import React from 'react';
import { observer } from 'mobx-react';
import { action, observable } from 'mobx';
import { t } from 'peerio-translator';
import { Dialog } from 'peer-ui';
import { User, errors } from 'peerio-icebear';
import uiStore from '~/stores/ui-store';
import routerStore from '~/stores/router-store';
import * as telemetry from '~/telemetry';

// Profile save handling
import languageStore from '~/stores/language-store';
import config from '~/config';
import * as autologin from '~/helpers/autologin';
import ProfileStore from './ProfileStore';

// Signup pages
import CreateAccount from './CreateAccount';
import GenerateAccountKey from './GenerateAccountKey';
import TermsOfUse from './TermsOfUse';
import ShareUsageData from './ShareUsageData';

@observer
export default class Signup extends React.Component {
    // Profile (name, username, etc.) save handling
    @observable profileStore = new ProfileStore();
    @observable busy = false;
    @observable errorVisible = false;
    @observable errorMessage = undefined;

    // Stepping through account creation process
    @observable currentStep = 0;

    @action.bound
    advanceStep() {
        if (this.currentStep + 1 > this.steps.length - 1) {
            !this.profileStore.hasErrors && this.finishCreateAccount();
            return;
        }
        this.currentStep += 1;
    }

    get steps() {
        return [
            <CreateAccount
                store={this.profileStore}
                onComplete={this.advanceStep}
            />,
            <GenerateAccountKey
                store={this.profileStore}
                onComplete={this.advanceStep}
            />,
            <TermsOfUse
                store={this.profileStore}
                onComplete={this.advanceStep}
            />,
            <ShareUsageData
                store={this.profileStore}
                onComplete={this.advanceStep}
            />
        ];
    }

    // Account creation itself
    finishCreateAccount = () => {
        if (this.busy) return Promise.resolve(false);
        this.hideError();
        this.busy = true;
        const u = new User();
        u.username = this.profileStore.username;
        u.email = this.profileStore.email;
        u.firstName = this.profileStore.firstName;
        u.lastName = this.profileStore.lastName;
        u.locale = languageStore.language;
        u.passphrase = this.profileStore.passphrase;

        // DEV MODE ONLY
        if (
            config.devAutologin &&
            config.devAutologin.signupPassphraseOverride
        ) {
            u.passphrase = config.devAutologin.signupPassphraseOverride;
        }

        User.current = u;
        return u
            .createAccountAndLogin()
            .then(() => {
                telemetry.signup.finishAccountCreation();
                this.busy = false;
                autologin.enable();
                autologin.dontSuggestEnablingAgain();
                uiStore.firstLogin = true;
                routerStore.navigateTo(routerStore.ROUTES.welcome);
            })
            .tapCatch(err => {
                User.current = null;
                this.busy = false;
                this.errorVisible = true;
                // todo: error message will not be localized, maybe don't use it at all
                this.errorMessage = `${t('error_signupServerError')} ${
                    errors.normalize(err).message
                }`;
            })
            .then(async () => {
                const { keyBackedUp } = this.profileStore;
                keyBackedUp && (await User.current.setAccountKeyBackedUp());
                const {
                    consentUsageData,
                    subscribeNewsletter
                } = this.profileStore;
                User.current.saveSettings(settings => {
                    settings.dataCollection = consentUsageData;
                    settings.errorTracking = consentUsageData;
                    settings.subscribeToPromoEmails = subscribeNewsletter;
                });
            });
    };

    @action.bound
    hideError() {
        this.errorVisible = false;
    }

    get errorDialog(): any {
        const errorActions = [
            { label: t('button_cancel'), onClick: this.hideError },
            { label: t('button_retry'), onClick: this.finishCreateAccount }
        ];
        return (
            <Dialog
                actions={errorActions}
                active={this.errorVisible}
                onCancel={this.hideError}
                title={t('title_error')}
            >
                {this.errorMessage}
            </Dialog>
        );
    }

    render() {
        return (
            <div className="signup">
                {this.steps[this.currentStep]}
                {this.errorDialog}
            </div>
        );
    }
}
