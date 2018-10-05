// @ts-check
const React = require('react');
const { observable, computed, action } = require('mobx');
const { observer } = require('mobx-react');
const { contactStore, User } = require('peerio-icebear');
const {
    Avatar,
    Dialog,
    Input,
    List,
    ListItem,
    MaterialIcon,
    Button
} = require('peer-ui');
const css = require('classnames');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const { getContactByEvent } = require('~/helpers/icebear-dom');
const { ModifyShareDialog } = require('./ModifyShareDialog');

/**
 * @typedef {'sharefiles' | 'sharefolders' | ''} ShareContext
 */

/**
 * @augments {React.Component<{}, {}>}
 */
@observer
class ShareWithMultipleDialog extends React.Component {
    /**
     * Reference to the promise resolver for returning the dialog result. When
     * the resolver is set to null, the dialog is hidden.
     *
     * @private
     * @type {(contactsToShareWith: any[] | null) => void | null}
     */
    @observable.ref resolver;

    @observable query = '';
    selectedUsers = observable.map();

    /**
     * Can be present to indicate the item being shared already has an existing
     * share (that is, this will not be null if we're trying to share a folder
     * that's already shared.)
     * @type {any | null}
     */
    @observable folderWithExistingShare = null;

    /** @type {ShareContext} */
    @observable shareContext = '';

    @action.bound
    handleTextChange(newVal) {
        this.query = newVal;
    }

    get existingUsers() {
        return this.folderWithExistingShare
            ? this.folderWithExistingShare.otherParticipants
            : [];
    }

    filterExisting = c => {
        return !this.existingUsers.find(u => u.username === c.username);
    };
    @computed
    get contacts() {
        const selectedUsernames = this.selectedUsers.keys();
        let ret = contactStore.whitelabel
            .filter(this.query, this.shareContext)
            .filter(c => !c.isDeleted)
            .filter(c => c.username !== User.current.username)
            .sort((c1, c2) => c1.username.localeCompare(c2.username));

        if (this.existingUsers && this.existingUsers.length > 0) {
            ret = ret.filter(this.filterExisting);
        }

        selectedUsernames.forEach(username => {
            if (!ret.find(c => c.username === username)) {
                ret.push(this.selectedUsers.get(username));
            }
        });
        return ret;
    }

    @action.bound
    async onContactClick(ev) {
        const contact = await getContactByEvent(ev);
        if (this.selectedUsers.has(contact.username)) {
            this.selectedUsers.delete(contact.username);
        } else {
            this.selectedUsers.set(contact.username, contact);
        }
    }

    renderContact = c => {
        const selected = this.selectedUsers.has(c.username);
        return (
            <div data-username={c.username} key={c.username}>
                <ListItem
                    className={css({ selected })}
                    leftIcon={
                        selected ? 'check_box' : 'check_box_outline_blank'
                    }
                    leftContent={<Avatar key="a" contact={c} size="small" />}
                    onClick={this.onContactClick}
                >
                    <span className="full-name">{c.fullName}</span>
                    <span className="username">@{c.username}</span>
                </ListItem>
            </div>
        );
    };

    /**
     * @param {any?} folderWithExistingShare
     * @param {ShareContext} shareContext
     */
    @action.bound
    show(folderWithExistingShare, shareContext) {
        this.folderWithExistingShare = folderWithExistingShare;
        this.shareContext = shareContext;
        this.selectedUsers.clear();
        return new Promise(resolve => {
            this.resolver = resolve;
        });
    }

    @action.bound
    close() {
        if (this.resolver) {
            this.resolver(null);
            this.resolver = null;
        }
        this.shareContext = '';
        this.folderWithExistingShare = null;
        this.query = '';
        this.selectedUsers.clear();
    }

    @action.bound
    share() {
        this.resolver(this.selectedUsers.values());
        this.close();
    }

    get sharedWithBlock() {
        return this.existingUsers.map(c => (
            <Avatar key={c.username} contact={c} size="tiny" tooltip />
        ));
    }

    @action.bound
    modifySharedWith() {
        this.modifyShareDialog.show();
    }

    get usersSelected() {
        return this.selectedUsers.size;
    }

    setModifyShareDialogRef = ref => {
        this.modifyShareDialog = ref;
    };

    render() {
        if (!this.resolver) return null;

        const dialogActions = [
            { label: t('button_cancel'), onClick: this.close },
            {
                label: t('button_share'),
                onClick: this.share,
                disabled: !this.usersSelected
            }
        ];
        const item = this.folderWithExistingShare;

        return (
            <div>
                {item && item.isFolder && item.isShared ? (
                    <ModifyShareDialog
                        ref={this.setModifyShareDialogRef}
                        folder={item}
                        contacts={this.existingUsers}
                    />
                ) : null}
                <Dialog
                    active
                    noAnimation
                    className="share-with-dialog share-folder"
                    actions={dialogActions}
                    onCancel={this.close}
                    title={t('title_shareWith')}
                >
                    <div className="share-with-contents">
                        <div className="user-search">
                            <MaterialIcon icon="search" />
                            <div className="chip-wrapper">
                                <Input
                                    placeholder={t('title_userSearch')}
                                    value={this.query}
                                    onChange={this.handleTextChange}
                                />
                            </div>
                        </div>
                        <div className="chat-list-container">
                            <div className="list-dms-container">
                                <div className="p-list-heading">
                                    <T k="title_contacts" />
                                    &nbsp;({this.contacts.length})
                                </div>
                                <List
                                    className="list-chats list-contacts"
                                    clickable
                                >
                                    {this.contacts.map(this.renderContact)}
                                </List>
                            </div>
                        </div>
                        {item &&
                        item.isFolder &&
                        item.isShared &&
                        this.existingUsers.length ? (
                            <div className="receipt-wrapper">
                                <Button
                                    label={t('title_viewSharedWith')}
                                    onClick={this.modifySharedWith}
                                />
                                {this.sharedWithBlock}
                            </div>
                        ) : null}
                        {item &&
                        item.isFolder &&
                        !item.isShared &&
                        !item.parent.isRoot ? (
                            <div className="move-to-root-notif p-list-heading">
                                <MaterialIcon icon="info" />
                                <T k="title_shareWillMoveToRoot" />
                            </div>
                        ) : null}
                    </div>
                </Dialog>
            </div>
        );
    }
}

module.exports = ShareWithMultipleDialog;
