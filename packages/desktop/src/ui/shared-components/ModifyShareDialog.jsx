const React = require('react');
const { observable, computed, action } = require('mobx');
const { observer } = require('mobx-react');

const css = require('classnames');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const { getContactByEvent } = require('~/helpers/icebear-dom');
const { Avatar, Dialog, List, ListItem, Button } = require('peer-ui');

/**
 * onSelectContact
 * onSelectChannel
 */
@observer
class ModifyShareDialog extends React.Component {
    @observable visible = false;

    @computed
    get contacts() {
        return this.props.contacts;
    }

    @action.bound
    async onContactClick(ev) {
        const contact = await getContactByEvent(ev);
        this.selectedUsers.set(contact.username, contact);
    }

    @action.bound
    show() {
        this.visible = true;
        return new Promise(resolve => {
            this.resolve = resolve;
        });
    }

    @action.bound
    close() {
        this.visible = false;
        this.resolve(null);
        this.resolve = null;
    }

    @action.bound
    share() {
        // TODO: this may be different is the dialog invoked
        // from different circumstances
        this.close();
    }

    render() {
        if (!this.visible) return false;
        const dialogActions = [
            { label: t('button_close'), onClick: this.close }
        ];

        return (
            <Dialog
                active
                noAnimation
                className="share-with-dialog share-folder modify-shared-with"
                actions={dialogActions}
                onCancel={this.close}
                title={t('title_sharedWith')}
            >
                <div className="share-with-contents">
                    <div className="chat-list-container">
                        <div className="list-dms-container">
                            <div className="p-list-heading">
                                <T k="title_contacts" />
                                &nbsp;({this.contacts.length})
                            </div>
                            <List className="list-chats list-dms">
                                {this.contacts.map(c => {
                                    return (
                                        <ModifyShareListItem
                                            key={c.username}
                                            contact={c}
                                            folder={this.props.folder}
                                        />
                                    );
                                })}
                            </List>
                        </div>
                    </div>
                    <div className="receipt-wrapper">
                        <Button
                            icon="person_add"
                            label={t('title_shareWithOthers')}
                            onClick={this.share}
                        />
                    </div>
                </div>
            </Dialog>
        );
    }
}

@observer
class ModifyShareListItem extends ListItem {
    @observable isClicked = false;

    @action.bound
    triggerRemoveUserWarning() {
        this.isClicked = true;
    }

    @action.bound
    handleRemove() {
        this.props.folder.removeParticipant(this.props.contact.username);
    }

    render() {
        const c = this.props.contact;

        return (
            <ListItem
                className={css('modify-share-list-item', {
                    expanded: this.isClicked
                })}
                leftContent={<Avatar key="a" contact={c} size="small" />}
                rightContent={
                    this.isClicked ? (
                        <a className="clickable" onClick={this.handleRemove}>
                            {t('button_remove')}
                        </a>
                    ) : this.props.folder.owner === c.username ? (
                        <T k="title_owner" className="badge-old-version" />
                    ) : (
                        <Button
                            icon="remove_circle_outline"
                            onClick={this.triggerRemoveUserWarning}
                        />
                    )
                }
            >
                <div>
                    <span className="full-name">{c.fullName}</span>
                    <span className="username">@{c.username}</span>
                </div>

                {this.isClicked ? (
                    <T
                        k="title_unshareUserWarning"
                        tag="div"
                        className="remove-user-warning"
                    >
                        {{
                            fileCount: this.props.folder.store.getFilesSharedBy(
                                c.username
                            ).length,
                            user: c.firstName
                        }}
                    </T>
                ) : null}
            </ListItem>
        );
    }
}

module.exports = { ModifyShareDialog, ModifyShareListItem };
