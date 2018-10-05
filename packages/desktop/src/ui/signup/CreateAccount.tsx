import React from 'react';
import { observer } from 'mobx-react';
import { action, computed, observable, reaction } from 'mobx';
import { t } from 'peerio-translator';
import css from 'classnames';
import { Button, Checkbox, Divider, MaterialIcon } from 'peer-ui';
import { config, validation } from 'peerio-icebear';
import uiStore from '~/stores/ui-store';
import routerStore from '~/stores/router-store';
import T from '~/ui/shared-components/T';
import ValidatedInput from '~/ui/shared-components/ValidatedInput';
import * as telemetry from '~/telemetry';
import * as Mock from './MockUI';

// Types
import { SignupStep, StepContentObject } from './SignupStepTypes';

// Input validation
const { validators } = validation; // use common validation from core
const { suggestUsername } = validators;
const MAX_NAME_LENGTH = config.user.maxNameLength;
const MAX_USERNAME_LENGTH = config.user.maxUsernameLength;

@observer
export default class CreateAccount extends React.Component<SignupStep> {
    // For measuring time-on-screen per step, for telemetry
    startTimeByStep: number[] = new Array(3);

    // Run username suggestion as soon as first and last name are found valid
    usernameReaction;

    componentDidMount() {
        this.usernameReaction = reaction(
            () =>
                this.props.store.firstNameValid &&
                this.props.store.lastNameValid,
            bothValid => {
                if (bothValid) {
                    this.suggestUsernames();
                }
            }
        );
        this.startTimeByStep[0] = Date.now();
    }

    componentWillUnmount() {
        if (this.usernameReaction) {
            this.usernameReaction();
            this.usernameReaction = null;
        }
    }

    // UI and user-facing functionality
    @observable currentStep = 0;

    get progressIndicator() {
        const lines = [];
        for (let i = 0; i < this.steps.length; i++) {
            lines.push(
                <div
                    key={`line-${i}`}
                    className={css('progress-line', {
                        active: this.currentStep === i
                    })}
                />
            );
        }

        return <div className="progress-indicator">{lines}</div>;
    }

    @computed
    get retreatDisabled() {
        return this.currentStep === 0;
    }

    advanceDisabled = () => {
        switch (this.currentStep) {
            case 0:
                return (
                    !this.props.store.firstNameValid ||
                    !this.props.store.lastNameValid
                );
            case 1:
                return !this.props.store.usernameValid;
            case 2:
                return !this.props.store.emailValid;
            default:
                return false;
        }
    };

    @action.bound
    advanceStep() {
        const noAdvance = this.advanceDisabled();
        if (noAdvance) return;

        telemetry.signup.advanceButton(this.currentStep);
        telemetry.signup.durationCreateAccount(
            this.currentStep,
            this.startTimeByStep[this.currentStep]
        );

        if (this.currentStep + 1 > this.steps.length - 1) {
            this.props.onComplete();
        } else {
            this.currentStep += 1;
            this.startTimeByStep[this.currentStep] = Date.now();
        }
    }

    @action.bound
    retreatStep() {
        telemetry.signup.retreatButton(this.currentStep);
        telemetry.signup.durationCreateAccount(
            this.currentStep,
            this.startTimeByStep[this.currentStep]
        );

        this.currentStep -= 1;
        this.startTimeByStep[this.currentStep] = Date.now();
    }

    @action.bound
    handleClearInput(name: string) {
        this.props.store[name] = '';
    }

    @action.bound
    handleKeyPress(ev: KeyboardEvent) {
        if (ev.key === 'Enter') {
            this.advanceStep();
        }
    }

    goToLogin = () => {
        telemetry.signup.goToLogin();
        telemetry.signup.durationCreateAccount(
            this.currentStep,
            this.startTimeByStep[this.currentStep]
        );
        uiStore.newUserPageOpen = false;
        routerStore.navigateTo(routerStore.ROUTES.login);
    };

    // Steps of account creation
    get steps(): StepContentObject[] {
        return [
            {
                left: this.chooseName,
                right: this.showName
            },
            {
                left: this.chooseUsername,
                right: this.showUsername
            },
            {
                left: this.chooseEmail,
                right: this.showEmail
            }
        ];
    }

    // Setting first name and last name
    get chooseName() {
        return (
            <React.Fragment>
                <T k="title_nameHeading" tag="div" className="guide-text" />
                <ValidatedInput
                    key="firstName"
                    label={t('title_firstName')}
                    position={1}
                    validator={validators.firstName}
                    name="firstName"
                    onKeyPress={this.handleKeyPress}
                    onClear={() => this.handleClearInput('firstName')}
                    store={this.props.store}
                    hint={
                        this.props.store.firstName.length >= MAX_NAME_LENGTH
                            ? t('title_characterLimitReached')
                            : null
                    }
                    maxLength={MAX_NAME_LENGTH}
                />
                <ValidatedInput
                    key="lastName"
                    label={t('title_lastName')}
                    position={2}
                    validator={validators.lastName}
                    name="lastName"
                    onKeyPress={this.handleKeyPress}
                    onClear={() => this.handleClearInput('lastName')}
                    store={this.props.store}
                    hint={
                        this.props.store.lastName.length >= MAX_NAME_LENGTH
                            ? t('title_characterLimitReached')
                            : null
                    }
                    maxLength={MAX_NAME_LENGTH}
                />
            </React.Fragment>
        );
    }

    get showName() {
        const name =
            this.props.store.firstName || this.props.store.lastName
                ? `${this.props.store.firstName} ${this.props.store.lastName}`
                : t('title_demoNamePlaceholder');

        return (
            <React.Fragment>
                <div className="top-lines">
                    <Mock.Line width={4} shade="verydark" />
                    <Mock.Line width={2} shade="verydark" />
                </div>
                <Mock.ChatEntry
                    key="name-1"
                    color="blue"
                    heading={4}
                    lines={[6]}
                />
                <Mock.ChatEntry
                    key="name-2"
                    className="popout"
                    color="purple"
                    heading={name}
                    lines={t('title_demoNamePurpose')}
                />
                <Mock.ChatEntry
                    key="name-3"
                    color="yellow"
                    heading={3}
                    lines={[6, 6]}
                />
                <Mock.ChatEntry
                    key="name-4"
                    color="blue"
                    heading={4}
                    lines={[6]}
                />
                <Mock.ChatInput />
            </React.Fragment>
        );
    }

    // Selecting username
    @computed
    get chooseUsername() {
        return (
            <React.Fragment>
                <T k="title_usernameHeading" tag="div" className="guide-text" />
                <ValidatedInput
                    key="username"
                    label={t('title_username')}
                    position={3}
                    lowercase="true"
                    validator={validators.username}
                    maxLength={MAX_USERNAME_LENGTH}
                    name="username"
                    store={this.props.store}
                    hint={t(
                        this.props.store.username.length < MAX_USERNAME_LENGTH
                            ? this.props.store.usernameValid
                                ? 'title_hintUsernameValid'
                                : 'title_hintUsername'
                            : 'title_characterLimitReached'
                    )}
                    onKeyPress={this.handleUsernameKeyPress}
                    onClear={() => this.handleClearInput('username')}
                    onError={telemetry.signup.onErrorUsername}
                />
                {this.usernameSuggestions.length > 0 ? (
                    <React.Fragment>
                        <Divider />
                        <div className="username-suggestions">
                            <T
                                k="title_available"
                                tag="span"
                                className="guide-text"
                            />
                            {this.usernameSuggestions.map(name => {
                                return (
                                    <span
                                        key={name}
                                        className="username clickable"
                                        onClick={() => this.setUsername(name)}
                                    >
                                        {name}
                                    </span>
                                );
                            })}
                        </div>
                    </React.Fragment>
                ) : null}
            </React.Fragment>
        );
    }

    @observable usernameEnteredManually = false;

    @action.bound
    handleUsernameKeyPress(ev) {
        this.usernameEnteredManually = true;
        this.handleKeyPress(ev);
    }

    @action.bound
    setUsername(name) {
        telemetry.signup.useSuggestedUsername(this.usernameEnteredManually);
        this.props.store.username = name;
    }

    @observable usernameSuggestions: string[] = [];
    @action.bound
    async suggestUsernames() {
        try {
            this.usernameSuggestions = await suggestUsername(
                this.props.store.firstName,
                this.props.store.lastName
            );
        } catch (e) {
            console.error(e);
        }
    }

    get showUsername() {
        // TODO: check if username is good first before rendering
        // needs to use new username suggestion SDK
        const usernameValid = this.props.store.usernameValid;

        const sampleHeading = (
            <React.Fragment>
                <span className="full-name">
                    {`${this.props.store.firstName} ${
                        this.props.store.lastName
                    }`}
                </span>&nbsp;
                <span className="username">@{this.props.store.username}</span>
            </React.Fragment>
        );

        const sampleText = (
            <T k="title_demoUsername">
                {{
                    username: () => {
                        return (
                            <span className="username-highlight">
                                @{this.props.store.usernameValid
                                    ? this.props.store.username
                                    : 'username'}
                            </span>
                        );
                    }
                }}
            </T>
        );

        return (
            <React.Fragment>
                <Mock.ChatEntry
                    key="user-1"
                    color="purple"
                    heading={2}
                    lines={[4, 6]}
                />
                <Mock.ChatEntry
                    key="user-2"
                    color="greyblue"
                    heading={2}
                    lines={[1]}
                />
                <Mock.ChatEntry
                    key="user-3"
                    color="blue"
                    heading={2}
                    lines={[4]}
                />
                <Mock.ChatEntry
                    className={css({ highlight: usernameValid })}
                    key="user-4"
                    color="purple"
                    heading={usernameValid ? sampleHeading : 4}
                    lines={sampleText}
                />
            </React.Fragment>
        );
    }

    // Setting email address
    get chooseEmail() {
        return (
            <React.Fragment>
                <T k="title_emailHeading" tag="div" className="guide-text" />
                <ValidatedInput
                    key="email"
                    label={t('title_email')}
                    position={4}
                    lowercase="true"
                    validator={validators.email}
                    name="email"
                    store={this.props.store}
                    hint={t('title_hintEmail')}
                    onKeyPress={this.handleKeyPress}
                    onClear={() => this.handleClearInput('email')}
                />
                <Divider />
                <Checkbox
                    checked={this.props.store.subscribeNewsletter}
                    onChange={this.onSubscriptionChange}
                    label={t('title_subscribePrompt')}
                />
            </React.Fragment>
        );
    }

    @action.bound
    onSubscriptionChange() {
        this.props.store.subscribeNewsletter = !this.props.store
            .subscribeNewsletter;
        telemetry.signup.clickNewsletter(this.props.store.subscribeNewsletter);
    }

    get showEmail() {
        const emailValid = this.props.store.emailValid;
        const { firstName, lastName, username, email } = this.props.store;

        return (
            <React.Fragment>
                <Mock.SearchBar>{emailValid ? email : null}</Mock.SearchBar>
                {emailValid ? (
                    <div className="highlight-entry-container">
                        <Mock.ChatEntry
                            className="highlight"
                            color="yellow"
                            circleContent={firstName[0].toUpperCase()}
                            heading={`${firstName} ${lastName}`}
                            lines={`@${username}`}
                        />
                        <MaterialIcon className="gold" icon="star" />
                    </div>
                ) : (
                    <Mock.ChatEntry color="yellow" heading={3} lines={[5]} />
                )}
                <Mock.ChatEntry color="purple" heading={3} lines={[5]} />
                <Mock.ChatEntry color="blue" heading={3} lines={[5]} />
            </React.Fragment>
        );
    }

    render() {
        const textParser = {
            toSignIn: text => (
                <a className="clickable" onClick={this.goToLogin}>
                    {text}
                </a>
            )
        };

        const content = this.steps[this.currentStep];
        const noAdvance = this.advanceDisabled();

        return (
            <div className={css('create-account', `step-${this.currentStep}`)}>
                <div className="left-container">
                    <div className="left-content-container">
                        <h2 className="heading">
                            <Button
                                className={css({
                                    banish: this.retreatDisabled
                                })}
                                icon="arrow_back"
                                onClick={this.retreatStep}
                            />
                            {t('title_createYourAccount')}
                        </h2>
                        {this.progressIndicator}
                        {content.left}

                        <div className="buttons-container">
                            <Button
                                className="advance-button"
                                onClick={this.advanceStep}
                                theme="affirmative"
                                disabled={noAdvance}
                            >
                                {t('button_next')}
                            </Button>
                        </div>

                        {this.currentStep === 0 ? (
                            <div className="back-to-login">
                                <T k="title_alreadyHaveAccount">{textParser}</T>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="right-container">
                    <div className="mock-app-ui">{content.right}</div>
                </div>
            </div>
        );
    }
}
