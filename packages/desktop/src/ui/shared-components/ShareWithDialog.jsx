const React = require('react');
const { observable, computed, action } = require('mobx');
const { observer } = require('mobx-react');
const { chatStore, contactStore, User } = require('peerio-icebear');
const {
    Avatar,
    Dialog,
    Input,
    List,
    ListItem,
    MaterialIcon
} = require('peer-ui');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const {
    getChannelByEvent,
    getContactByEvent
} = require('~/helpers/icebear-dom');

/**
 * onSelectContact
 * onSelectChannel
 */
@observer
class ShareWithDialog extends React.Component {
    @observable query = '';

    @action.bound
    handleTextChange(newVal) {
        this.query = newVal;
    }

    @computed
    get contacts() {
        return contactStore.whitelabel
            .filter(this.query, this.props.context)
            .filter(c => c.username !== User.current.username)
            .sort((c1, c2) => c1.username.localeCompare(c2.username));
    }

    @computed
    get channels() {
        let result = chatStore.channels;
        if (this.query)
            result = result.filter(c => c.name.startsWith(this.query));
        return result;
    }

    @action.bound
    async onChannelClick(ev) {
        this.props.deactivate();
        this.props.onSelectChannel(await getChannelByEvent(ev));
    }

    @action.bound
    async onContactClick(ev) {
        this.props.deactivate();
        this.props.onSelectContact(await getContactByEvent(ev));
    }

    cancelDialog = () => {
        this.props.deactivate();
    };

    renderChannel = c => {
        return (
            <div data-channelid={c.id} key={c.id}>
                <ListItem
                    onClick={this.onChannelClick}
                    caption={`# ${c.name}`}
                />
            </div>
        );
    };

    renderContact = c => {
        return (
            <div data-username={c.username} key={c.username}>
                <ListItem
                    leftContent={<Avatar key="a" contact={c} size="medium" />}
                    caption={c.username}
                    legend={c.fullName}
                    onClick={this.onContactClick}
                />
            </div>
        );
    };

    render() {
        const dialogActions = [
            { label: t('button_close'), onClick: this.cancelDialog }
        ];

        return (
            <Dialog
                active
                noAnimation
                className="share-with-dialog"
                actions={dialogActions}
                onCancel={this.cancelDialog}
                title={t('title_shareWith')}
            >
                <div className="share-with-contents">
                    <div className="user-search">
                        <MaterialIcon icon="search" />
                        <div className="chip-wrapper">
                            <Input
                                placeholder={t('title_enterRoomOrContact')}
                                value={this.query}
                                onChange={this.handleTextChange}
                                onKeyDown={this.handleKeyDown}
                                noHelperText
                            />
                        </div>
                    </div>
                    <div className="chat-list-container">
                        <div className="list-channels-container">
                            <div className="p-list-heading">
                                <T k="title_channels" />
                                &nbsp;({this.channels.length})
                            </div>
                            <List
                                className="list-chats list-channels"
                                clickable
                            >
                                {this.channels.map(this.renderChannel)}
                            </List>
                        </div>
                        <div className="list-dms-container">
                            <div className="p-list-heading">
                                <T k="title_contacts" />
                                &nbsp;({this.contacts.length})
                            </div>
                            <List className="list-chats list-dms" clickable>
                                {this.contacts.map(this.renderContact)}
                            </List>
                        </div>
                    </div>
                </div>
            </Dialog>
        );
    }
}

module.exports = ShareWithDialog;
