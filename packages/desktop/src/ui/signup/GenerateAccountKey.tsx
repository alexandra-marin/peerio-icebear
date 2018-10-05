import React from 'react';
import { observer } from 'mobx-react';
import { computed, observable } from 'mobx';
import css from 'classnames';
import { t } from 'peerio-translator';
import { Button, MaterialIcon } from 'peer-ui';
import { warnings } from 'peerio-icebear';
import T from '~/ui/shared-components/T';
import { saveAkPdf } from '~/helpers/account-key';
import * as telemetry from '~/telemetry';
import * as Mock from './MockUI';
import { SignupStep } from './SignupStepTypes';
const { clipboard } = require('electron').remote;
import isDevEnv from '~/helpers/is-dev-env';

@observer
export default class GenerateAccountKey extends React.Component<SignupStep> {
    @observable keyReady = isDevEnv;
    generateTimer;
    startTime: number;

    componentWillMount() {
        this.props.store.rerollPassphrase();
        this.generateTimer = setTimeout(() => {
            this.keyReady = true;
            this.generateTimer = null;
        }, 11900);

        this.startTime = Date.now();
    }

    componentWillUnmount() {
        if (this.generateTimer) {
            this.generateTimer = null;
        }
        telemetry.signup.durationGenerateAk(this.startTime);
    }

    get loadingAnimation() {
        const bars = [];
        for (let i = 0; i < 8; i++) {
            bars.push(
                <div
                    key={`bar-${i}`}
                    className={css('loading-bar', `bar-${i}`)}
                />
            );
        }
        return bars;
    }

    get generateAK() {
        return <React.Fragment />;
    }

    @computed
    get akDisplay() {
        const akChunks = this.props.store.passphrase.split(' ');
        const akFirstHalf = akChunks.slice(0, 4).join(' ');
        const akSecondHalf = akChunks.slice(4).join(' ');

        return (
            <React.Fragment>
                <div className="ak-half">{akFirstHalf}</div>{' '}
                <div className="ak-half">{akSecondHalf}</div>
            </React.Fragment>
        );
    }

    get akPreview() {
        const { username } = this.props.store;

        return (
            <div className="ak-preview fade-1">
                <div className="preview-content">
                    <div className="input-container">
                        <T
                            k="title_demoPdfUsernameLabel"
                            className="label"
                            tag="div"
                        />
                        <div className="input">{username}</div>
                    </div>
                    <div className="input-container">
                        <T
                            k="title_demoPdfAkLabel"
                            className="label"
                            tag="div"
                        />
                        <div className="input">{this.akDisplay}</div>
                    </div>
                </div>
                <div className="ui-bar">
                    <div className="left-info">{`${username}-peerio.pdf`}</div>
                    <Button
                        onClick={this.akDownload}
                        theme="affirmative"
                        label={t('button_downloadPdf')}
                    />
                </div>
            </div>
        );
    }

    akCopy = () => {
        telemetry.signup.copyAk();
        clipboard.writeText(this.props.store.passphrase);
        warnings.add('title_copied');
    };

    akDownload = async () => {
        telemetry.signup.downloadAk();
        await saveAkPdf(this.props.store);

        // NOTICE: user can press cancel and this flag would still be set to true
        this.props.store.keyBackedUp = true;
    };

    advanceStep = () => {
        telemetry.signup.completeGenerateAk(this.props.store.keyBackedUp);
        this.props.onComplete();
    };

    get mockLogin() {
        return (
            <div className="mock-login">
                <div className="head-container">
                    <img
                        alt="Peerio logo"
                        className="logo"
                        src="static/img/logo-mark.svg"
                    />
                    <Mock.Line width={2} shade="verydark" />
                </div>

                <div className="mock-input-container">
                    <Mock.TextInput
                        placeholder={t('title_username')}
                        active={this.keyReady}
                    >
                        {this.keyReady ? this.props.store.username : null}
                    </Mock.TextInput>
                </div>
                <div
                    className={css('mock-input-container', {
                        highlight: this.keyReady
                    })}
                >
                    <Mock.TextInput placeholder="******" active={this.keyReady}>
                        {this.keyReady ? '**** **** **** **** **** ****' : null}
                    </Mock.TextInput>
                    {this.keyReady ? (
                        <MaterialIcon icon="check_circle" />
                    ) : null}
                </div>

                <div
                    className={css('buttons-container', {
                        hide: !this.keyReady
                    })}
                >
                    <Button theme="affirmative" />
                </div>
            </div>
        );
    }

    render() {
        return (
            <div className="generate-account-key">
                <div className="left-container">
                    <div className="left-content-container">
                        <T
                            k="title_generatingAk"
                            tag="h2"
                            className="heading"
                        />
                        <T
                            k="title_generatingAkDescription"
                            tag="div"
                            className="guide-text"
                        />

                        <div className="main-container">
                            <div className="ak-container">
                                <div className="ak-content">
                                    {this.keyReady
                                        ? this.akDisplay
                                        : this.loadingAnimation}
                                </div>
                                <Button
                                    className={css({ hide: !this.keyReady })}
                                    onClick={this.akCopy}
                                    disabled={!this.keyReady}
                                    label={t('button_copy')}
                                />
                            </div>
                            {this.keyReady ? (
                                <React.Fragment>
                                    <T
                                        k="title_akBackupDescription"
                                        tag="p"
                                        className="fade-0"
                                    />
                                    {this.akPreview}
                                    <Button
                                        className="skip-backup fade-2"
                                        onClick={this.advanceStep}
                                    >
                                        {this.props.store.keyBackedUp
                                            ? 'Next'
                                            : 'Skip Backup'}
                                    </Button>
                                </React.Fragment>
                            ) : (
                                <T k="title_generatingAkExplanation" tag="p" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="right-container">
                    <div className="mock-app-ui">{this.mockLogin}</div>
                </div>
            </div>
        );
    }
}
