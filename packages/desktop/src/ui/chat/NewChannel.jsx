const React = require('react');
const { observable, when } = require('mobx');
const { observer } = require('mobx-react');
const { chatStore, config, User } = require('peerio-icebear');
const UserPicker = require('~/ui/shared-components/UserPicker');
const { t } = require('peerio-translator');
const T = require('~/ui/shared-components/T');
const { Input, ProgressBar } = require('peer-ui');

@observer
class NewChannel extends React.Component {
    @observable waiting = false;
    @observable channelName = '';
    @observable purpose = '';

    componentDidMount() {
        if (this.isLimitReached) this.upgradeDialog.show();
    }

    get isLimitReached() {
        return User.current.channelsLeft === 0;
    }

    handleAccept = async () => {
        this.waiting = true;
        const chat = await chatStore.startChat(
            this.userPicker.selected,
            true,
            this.channelName,
            this.purpose
        );
        if (!chat) {
            this.waiting = false;
            return;
        }
        when(
            () => chat.added === true,
            () => {
                window.router.push('/app/chats');
            }
        );
    };

    gotoNewChat() {
        window.router.push('/app/chats/new-chat');
    }

    handleNameChange = val => {
        this.channelName = val;
    };

    handlePurposeChange = val => {
        this.purpose = val;
    };

    setUserPickerRef = ref => {
        this.userPicker = ref;
    };

    setUpgradeDialogRef = ref => {
        this.upgradeDialog = ref;
    };

    setNameInputRef = ref => {
        if (!ref) return;
        ref.focus();
    };

    render() {
        const textParser = {
            toCreateDM: text => (
                <a className="clickable" onClick={this.gotoNewChat}>
                    {text}
                </a>
            )
        };

        if (this.waiting) {
            return (
                <div className="new-channel create-new-chat">
                    <div className="create-channel-loading">
                        <ProgressBar type="circular" />
                    </div>
                </div>
            );
        }
        return (
            <div className="new-channel create-new-chat">
                <div className="chat-creation-header">
                    <div className="title">
                        <T k="title_createChannel" tag="span" />
                    </div>
                    <div className="description">
                        <T k="title_createChannelDetails" />
                        <T k="title_offerNewDM">{textParser}</T>
                    </div>
                </div>
                <div className="new-channel-inputs">
                    <div className="message-search-wrapper-new-channel message-search-wrapper">
                        <div className="new-chat-search">
                            <div className="chip-wrapper">
                                <Input
                                    placeholder={t('title_channelName')}
                                    innerRef={this.setNameInputRef}
                                    value={this.channelName}
                                    onChange={this.handleNameChange}
                                    maxLength={config.chat.maxChatNameLength}
                                />
                            </div>
                        </div>
                        <div className="helper-text" />
                    </div>
                    <div className="message-search-wrapper-new-channel message-search-wrapper">
                        <div className="new-chat-search">
                            <div className="chip-wrapper">
                                <Input
                                    placeholder={t('title_purpose')}
                                    value={this.purpose}
                                    onChange={this.handlePurposeChange}
                                    maxLength={config.chat.maxChatPurposeLength}
                                />
                            </div>
                        </div>
                        <T
                            k="title_optional"
                            tag="div"
                            className="helper-text"
                        />
                    </div>
                    <div className="user-picker-container">
                        <UserPicker
                            ref={this.setUserPickerRef}
                            title={t('title_chatWith')}
                            noHeader
                            onlyPick
                            noAutoFocus
                            onAccept={this.handleAccept}
                            noSubmit={!this.channelName.length}
                        />
                    </div>
                </div>
                {/* <ChannelUpgradeDialog ref={this.setUpgradeDialogRef} /> */}
            </div>
        );
    }
}

module.exports = NewChannel;
