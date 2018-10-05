const React = require('react');
const { Button } = require('peer-ui');
const { User, warnings } = require('peerio-icebear');
const { observable, action } = require('mobx');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const css = require('classnames');
const FullCoverLoader = require('~/ui/shared-components/FullCoverLoader');
const { Passcode, PasscodeStore } = require('../signup/Passcode');
const T = require('~/ui/shared-components/T');

@observer
class NewDevice extends React.Component {
    @observable busy = false;

    passcodeStore = new PasscodeStore();

    constructor() {
        super();
        this.createPasscode = this.createPasscode.bind(this);
        this.skip = this.skip.bind(this);
    }

    /**
     * Disallow user's names.
     */
    componentDidMount() {
        this.passcodeStore.addToBanList([
            User.current.username,
            User.current.firstName,
            User.current.lastName
        ]);
    }

    /**
     * Set passcode.
     *
     * @returns {Promise}
     */
    @action
    createPasscode() {
        if (this.passcodeStore.hasErrors || this.busy)
            return Promise.resolve(false);
        this.busy = true;
        return User.current
            .setPasscode(this.passcodeStore.passcode)
            .then(() => {
                this.busy = false;
                warnings.add('warning_passcodeAdded');
                window.router.push('/app/chats');
            });
    }

    /**
     * Disable passcode.
     */
    skip() {
        this.busy = true;
        User.current.disablePasscode().then(() => {
            this.busy = false;
            window.router.push('/app/chats');
        });
    }

    render() {
        return (
            <div className={css('signup', 'show', 'test-new-device')}>
                <div className="signup-content">
                    <img className="logo" src="static/img/logo-white.png" />
                    <div className="signup-form">
                        <div className="passcode">
                            <div className="signup-title">
                                {t('title_newDeviceSetup')}
                            </div>
                            <div className="signup-subtitle">
                                {t('title_createPassword')}
                            </div>
                            <p>
                                <T
                                    k="title_passwordIntro"
                                    className="signup-title"
                                />
                            </p>
                            <p>{t('title_passwordSkip')}</p>
                            <Passcode
                                store={this.passcodeStore}
                                returnHandler={this.createPasscode}
                            />
                        </div>
                    </div>
                    <FullCoverLoader show={this.busy} />

                    <div className="signup-nav">
                        <Button label={t('button_skip')} onClick={this.skip} />
                        <Button
                            label={t('button_finish')}
                            onClick={this.createPasscode}
                            disabled={this.passcodeStore.hasErrors}
                        />
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = NewDevice;
