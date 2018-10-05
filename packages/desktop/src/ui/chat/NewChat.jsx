const React = require('react');
const { observable, when } = require('mobx');
const { observer } = require('mobx-react');
const { chatStore } = require('peerio-icebear');
const UserPicker = require('~/ui/shared-components/UserPicker');
const { t } = require('peerio-translator');
const FullCoverLoader = require('~/ui/shared-components/FullCoverLoader');
const ELEMENTS = require('~/whitelabel/helpers/elements');

@observer
class NewChat extends React.Component {
    @observable waiting = false;
    @observable picker;

    componentDidMount() {
        chatStore.deactivateCurrentChat();
    }

    handleAccept = async selected => {
        this.waiting = true;
        if (!selected.length || selected.filter(c => c.notFound).length) {
            this.waiting = false;
            return;
        }
        const chat = await chatStore.startChat(selected);
        if (!chat) {
            this.waiting = false;
            return;
        }
        when(
            () => chat.added === true,
            () => {
                this.waiting = false;
                window.router.push('/app/chats');
            }
        );
    };

    handleClose() {
        window.router.push('/app/chats');
    }

    render() {
        return (
            <div className="new-dm create-new-chat">
                <div className="user-picker-container">
                    <UserPicker
                        title={t('title_newDirectMessage')}
                        description={ELEMENTS.newChat.description}
                        limit={1}
                        onAccept={this.handleAccept}
                        onClose={this.handleClose}
                        isDM
                        context="newchat"
                    />
                </div>
                <FullCoverLoader show={this.waiting} />
            </div>
        );
    }
}

module.exports = NewChat;
