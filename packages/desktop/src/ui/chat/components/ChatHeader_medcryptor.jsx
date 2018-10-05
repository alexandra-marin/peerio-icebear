const React = require('react');
const { computed } = require('mobx');
const { observer } = require('mobx-react');
const { chatStore } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');
const { MaterialIcon } = require('peer-ui');
const AvatarWithPopup = require('~/ui/contact/components/AvatarWithPopup')
    .default;
const IdentityVerificationNotice = require('~/ui/chat/components/IdentityVerificationNotice')
    .default;

@observer
class ChatHeader extends React.Component {
    @computed
    get displayParticipants() {
        const chat = chatStore.activeChat;
        if (!chat) return [];
        if (chat.isChannel) return chat.allParticipants;
        return chat.otherParticipants;
    }

    get chatHeaderNotice() {
        if (chatStore.activeChat.isInSpace) {
            return (
                <div className="identity-verification-notice">
                    <div className="notice-container">
                        <MaterialIcon className="notice-icon" icon="security" />
                        <T
                            className="text-content"
                            k={
                                chatStore.spaces.isPatientRoomOpen
                                    ? 'mcr_title_patientRoomNotice'
                                    : 'mcr_title_internalRoomNotice'
                            }
                        />
                    </div>
                </div>
            );
        }

        return <IdentityVerificationNotice />;
    }

    render() {
        const chat = chatStore.activeChat;

        return (
            <div className="messages-start">
                <div className="avatars">
                    {this.displayParticipants.map(c => (
                        <AvatarWithPopup
                            size="large"
                            key={c.username}
                            contact={c}
                            tooltip
                        />
                    ))}
                </div>
                {chatStore.activeChat.isInSpace ? (
                    chatStore.spaces.isPatientRoomOpen ? (
                        <T
                            k="mcr_title_chatHeaderPatientRoom"
                            tag="div"
                            className="title"
                        >
                            {{ patientName: chatStore.spaces.currentSpaceName }}
                        </T>
                    ) : (
                        <T
                            k="mcr_title_chatHeaderInternalRoom"
                            tag="div"
                            className="title"
                        >
                            {{ roomName: chat.nameInSpace }}
                        </T>
                    )
                ) : (
                    <T
                        k={
                            chat.isChannel
                                ? 'title_chatBeginningRoom'
                                : 'title_chatBeginning'
                        }
                        tag="div"
                        className="title"
                    >
                        {{ chatName: chat.name }}
                    </T>
                )}
                {this.chatHeaderNotice}
            </div>
        );
    }
}

module.exports = ChatHeader;
