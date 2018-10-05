const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const {
    Avatar,
    Button,
    List,
    ListItem,
    MaterialIcon,
    ProgressBar
} = require('peer-ui');
const { User, contactStore, validation } = require('peerio-icebear');
const { t } = require('peerio-translator');
const BetterInput = require('~/ui/shared-components/BetterInput');
const css = require('classnames');
const AvatarEditor = require('./AvatarEditor');

@observer
class Profile extends React.Component {
    @observable addMode = false;
    @observable newEmail = '';
    @observable newEmailValid = false;

    componentWillMount() {
        this.contact = contactStore.getContact(User.current.username);
    }

    saveFirstName(val) {
        const prev = User.current.firstName;
        User.current.firstName = val;
        User.current.saveProfile().catch(() => {
            User.current.firstName = prev;
        });
    }

    saveLastName(val) {
        const prev = User.current.lastName;
        User.current.lastName = val;
        User.current.saveProfile().catch(() => {
            User.current.lastName = prev;
        });
    }

    // avatar ------
    handleDeleteAvatar = () => {
        User.current.deleteAvatar();
    };

    saveAvatar = async blobs => {
        const buffers = await AvatarEditor.closeAndReturnBuffers(blobs);
        await User.current.saveAvatar(buffers);
    };

    // ----- Emails -----
    switchToAddMode = () => {
        this.newEmail = '';
        this.addMode = true;
    };

    onNewEmailChange = (val, isValid) => {
        this.newEmail = val;
        this.newEmailValid = isValid;
    };

    onNewEmailAccept = (val, isValid) => {
        this.newEmail = val;
        this.newEmailValid = isValid;
        this.saveNewEmail();
    };

    cancelNewEmail = () => {
        this.addMode = false;
        this.newEmailValid = false;
        this.newEmail = '';
    };

    saveNewEmail = () => {
        if (this.newEmail && this.newEmailValid)
            User.current.addEmail(this.newEmail);
        this.cancelNewEmail();
    };

    removeEmail(email) {
        if (!confirm(`${t('title_confirmRemoveEmail')} ${email}`)) return;
        User.current.removeEmail(email);
    }

    resendConfirmation(email) {
        User.current.resendEmailConfirmation(email);
    }

    makePrimary(email) {
        User.current.makeEmailPrimary(email);
    }

    renderButton(a) {
        return (
            <div>
                {a.confirmed ? null : (
                    <Button
                        tooltip={t('button_resend')}
                        icon="mail"
                        theme="no-hover"
                        onClick={() => {
                            this.resendConfirmation(a.address);
                        }}
                    />
                )}
                {a.primary ? null : (
                    <Button
                        tooltip={t('button_delete')}
                        icon="delete"
                        theme="no-hover"
                        onClick={() => {
                            this.removeEmail(a.address);
                        }}
                    />
                )}
            </div>
        );
    }

    renderPrimaryEmail(a) {
        return a.primary ? t('title_primaryEmail') : null;
    }

    // ------ /Emails -----
    render() {
        const f = this.contact.fingerprint.split('-');
        const user = User.current;
        if (AvatarEditor.state.showEditor) {
            return (
                <section className="settings-avatar-editor">
                    <AvatarEditor onSave={this.saveAvatar} />
                </section>
            );
        }
        return (
            <div className="settings-container-profile">
                <div>
                    <div className="input-row">
                        <BetterInput
                            onAccept={this.saveFirstName}
                            label={t('title_firstName')}
                            value={user.firstName}
                        />
                        <BetterInput
                            onAccept={this.saveLastName}
                            label={t('title_lastName')}
                            value={user.lastName}
                        />
                    </div>
                    <div className="dark-label label-email">
                        {t('title_email')}
                    </div>
                    <List theme="no-hover">
                        {user.addresses.map(a => {
                            const leftButton = a.primary ? (
                                <MaterialIcon
                                    icon="radio_button_checked"
                                    className="selected"
                                />
                            ) : (
                                <Button
                                    className={a.confirmed ? '' : 'hide'}
                                    disabled={!a.confirmed}
                                    tooltip={t('button_makePrimary')}
                                    icon="radio_button_unchecked"
                                    onClick={() => {
                                        this.makePrimary(a.address);
                                    }}
                                    theme="small no-hover"
                                />
                            );

                            const legend = a.confirmed
                                ? a.primary
                                    ? t('title_primaryEmail')
                                    : null
                                : t('error_unconfirmedEmail');

                            const rightButton =
                                a.confirmed && !a.primary ? (
                                    <Button
                                        tooltip={t('button_delete')}
                                        icon="delete"
                                        onClick={() => {
                                            this.removeEmail(a.address);
                                        }}
                                        theme="no-hover"
                                    />
                                ) : (
                                    this.renderButton(a)
                                );

                            return (
                                <ListItem
                                    key={a.address}
                                    className={css('email-row', {
                                        unconfirmed: !a.confirmed
                                    })}
                                    leftContent={leftButton}
                                    caption={a.address}
                                    legend={legend}
                                    rightContent={rightButton}
                                />
                            );
                        })}
                    </List>
                    {this.addMode ? (
                        <div className="addemail-container">
                            <BetterInput
                                type="email"
                                label={t('title_email')}
                                acceptOnBlur="false"
                                validator={
                                    validation.validators.emailFormat.action
                                }
                                onChange={this.onNewEmailChange}
                                value={this.newEmail}
                                error="error_invalidEmail"
                                onAccept={this.onNewEmailAccept}
                                onReject={this.cancelNewEmail}
                            />
                            <Button
                                tooltip={t('button_save')}
                                icon="done"
                                onClick={this.saveNewEmail}
                                disabled={!this.newEmailValid}
                                theme="no-hover"
                            />
                            <Button
                                tooltip={t('button_cancel')}
                                icon="cancel"
                                onClick={this.cancelNewEmail}
                                theme="no-hover"
                            />
                        </div>
                    ) : null}
                    {this.addMode || user.addresses.length > 2 ? null : (
                        <Button
                            label={t('button_addEmail')}
                            onClick={this.switchToAddMode}
                        />
                    )}

                    <div className="row peerio-id-container">
                        <div className="list-title">
                            {' '}
                            {t('title_publicKey')}
                        </div>
                        <div className="monospace selectable">
                            {f[0]} {f[1]} {f[2]}
                        </div>
                        <div className="monospace selectable">
                            {f[3]} {f[4]} {f[5]}
                        </div>
                    </div>
                </div>
                <div className="avatar-card">
                    <div className="card-header">
                        <div className="full-name">{this.contact.fullName}</div>
                        <div className="username">@{this.contact.username}</div>
                    </div>
                    <Avatar contact={this.contact} size="full" />
                    <div className="card-footer">
                        <Button
                            icon="delete"
                            className={css({ banish: !this.contact.hasAvatar })}
                            onClick={this.handleDeleteAvatar}
                            tooltip={t('button_delete')}
                        />
                        <Button
                            icon="add_a_photo"
                            onClick={AvatarEditor.selectFile}
                            tooltip={t('button_updateAvatar')}
                        />
                    </div>
                    {User.current.savingAvatar ? (
                        <div className="save-progress-overlay">
                            <ProgressBar type="circular" mode="indeterminate" />
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }
}
module.exports = Profile;
