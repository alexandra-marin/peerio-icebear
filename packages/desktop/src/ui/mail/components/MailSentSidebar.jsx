const React = require('react');
const { Button, Dialog } = require('peer-ui');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const { warnings } = require('peerio-icebear');
const MailPassphrase = require('./MailPassphrase');

@observer
class MailSentSidebar extends React.Component {
    @observable revokeDialogActive = false;
    @observable ghostActive = true;

    revokeGhost = () => {
        return this.props.ghost.revoke().then(() => {
            this.hideRevokeDialog();
            warnings.add('warning_mailRevoked');
        });
    };

    showRevokeDialog = () => {
        this.revokeDialogActive = true;
    };

    hideRevokeDialog = () => {
        this.revokeDialogActive = false;
    };

    componentDidUpdate() {
        this.ghostActive =
            !this.props.ghost.expired && !this.props.ghost.revoked;
    }

    copyLink = () => {
        const range = document.createRange();
        const selection = document.getSelection();
        selection.removeAllRanges();
        range.selectNode(this.link);
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
    };

    render() {
        const revokeDialogActions = [
            {
                label: t('button_cancel'),
                onClick: () => {
                    this.hideRevokeDialog();
                }
            },
            {
                label: t('button_mailRevoke'),
                onClick: () => {
                    this.revokeGhost();
                }
            }
        ];
        return (
            <div className="mail-sent-sidebar">
                <MailPassphrase ghost={this.props.ghost} />
                <div className="sent-info">
                    <div className="read-recipt">
                        <div className="dark-label">{t('title_mailUrl')}</div>
                        <div className="mail-link">
                            <a
                                href={this.props.ghost.url}
                                ref={l => {
                                    this.link = l;
                                }}
                            >
                                {this.props.ghost.url}
                            </a>
                            <Button
                                tooltip={t('title_copy')}
                                tooltipPosition="bottom"
                                icon="content_copy"
                                onClick={this.copyLink}
                            />
                        </div>
                    </div>
                    <div className="expire-info">
                        {this.ghostActive ? (
                            <div className="content">
                                <div className="dark-label">
                                    {t('title_mailExpires')}
                                </div>
                                <div>
                                    {this.props.ghost.expiryDate.toLocaleString()}
                                </div>
                                <Button
                                    className="mail-revoke"
                                    label={t('button_mailRevoke')}
                                    onClick={this.showRevokeDialog}
                                />
                            </div>
                        ) : (
                            <div className="dark-label">
                                {this.props.ghost.revoked
                                    ? t('warning_mailRevoked')
                                    : t('title_mailExpired')}
                            </div>
                        )}
                    </div>
                </div>
                {this.ghostActive ? (
                    <Dialog
                        actions={revokeDialogActions}
                        active={this.revokeDialogActive}
                        onCancel={this.handleRevokeDialogToggle}
                        title={t('title_mailRevoke')}
                    >
                        <p>{t('dialog_mailRevokeText')}</p>
                    </Dialog>
                ) : (
                    ''
                )}
            </div>
        );
    }
}

module.exports = MailSentSidebar;
