const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const { Button, Dialog, Divider, Menu, MenuItem } = require('peer-ui');
const MailSentSidebar = require('./MailSentSidebar');
const InlineFiles = require('../../chat/components/InlineFiles');
const { fileStore, warnings, ghostStore } = require('peerio-icebear');

@observer
class MailSent extends React.Component {
    @observable deleteDialogActive = false;

    handleClose = () => {
        this.deleteDialogActive = false;
    };

    deleteGhost = () => {
        ghostStore.remove(this.props.ghost).then(() => {
            this.handleClose();
            warnings.add('snackbar_mailDeleted');
        });
    };

    handleDelete = () => {
        // requires confirmation only if the ghost is active
        if (!this.props.ghost.expired && !this.props.ghost.revoked) {
            this.deleteDialogActive = true;
        } else {
            this.deleteGhost();
        }
    };

    render() {
        const deleteActions = [
            {
                label: t('button_cancel'),
                onClick: () => {
                    this.handleClose();
                }
            },
            {
                label: t('button_delete'),
                onClick: () => {
                    this.deleteGhost();
                },
                primary: true
            }
        ];

        return (
            <div className="mail-sent-container">
                <div className="compose-view">
                    <div className="compose-meta sent">
                        <div className="meta-container">
                            <div className="subject">
                                {this.props.ghost.subject}
                            </div>
                            <Button
                                tooltip={t('button_delete')}
                                tooltipPosition="bottom"
                                icon="delete"
                                onClick={this.handleDelete}
                            />

                            {this.props.ghost.files.length ? (
                                <div className="attached-files">
                                    {this.props.ghost.files.length}
                                    <Menu icon="attachment">
                                        <MenuItem
                                            caption="Download all"
                                            icon="file_download"
                                        />
                                        <Divider />
                                        {this.props.ghost.files.map(f => {
                                            const file = fileStore.getById(f);
                                            return (
                                                <MenuItem
                                                    key={f}
                                                    caption={file.name}
                                                    icon="file_download"
                                                />
                                            );
                                        })}
                                    </Menu>
                                </div>
                            ) : null}
                        </div>
                        <div className="date">
                            {this.props.ghost.date.format('LLL')}
                        </div>
                        <div className="to">
                            {this.props.ghost.recipients.join(',')}
                        </div>
                    </div>
                    <div className="mail-content sent-content">
                        {this.props.ghost.body}
                    </div>
                    {this.props.ghost.files !== 0 ? (
                        <InlineFiles files={this.props.ghost.files} />
                    ) : null}
                </div>
                <MailSentSidebar ghost={this.props.ghost} />
                <Dialog
                    title={t('title_mailDelete')}
                    actions={deleteActions}
                    active={this.deleteDialogActive}
                    onCancel={this.handleClose}
                >
                    {t('dialog_mailDeleteText')}
                </Dialog>
            </div>
        );
    }
}

module.exports = MailSent;
