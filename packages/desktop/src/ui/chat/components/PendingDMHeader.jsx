const React = require('react');
const { observer } = require('mobx-react');
const { chatStore } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');

const AvatarWithPopup = require('~/ui/contact/components/AvatarWithPopup')
    .default;
const EmojiImage = require('~/ui/emoji/Image');
const IdentityVerificationNotice = require('~/ui/chat/components/IdentityVerificationNotice')
    .default;

@observer
class PendingDMHeader extends React.Component {
    render() {
        const c = this.props.contact;
        const chat = chatStore.activeChat;

        return (
            <div className="pending-dm-header">
                <EmojiImage emoji="tada" size="large" />

                {this.props.isNewUser ? (
                    <T k="title_newUserDmInviteHeading" className="main-text">
                        {{ contactName: c.fullName }}
                    </T>
                ) : (
                    <div className="main-text">
                        <T k="title_goodNews" />
                        <br />
                        <T k="title_dmInviteHeading">
                            {{ contactName: c.fullName }}
                        </T>
                    </div>
                )}

                {this.props.isNewUser ? null : (
                    <T
                        k={
                            chat.isAutoImport
                                ? 'title_userInAddressBook'
                                : 'title_invitedUserViaEmail'
                        }
                        className="invite-type"
                    >
                        {{ firstName: c.firstName, email: chat.email }}
                    </T>
                )}

                <div className="user-profile-container">
                    <AvatarWithPopup contact={c} size="large" />
                    <div className="username">@{c.username}</div>
                </div>

                <IdentityVerificationNotice />
            </div>
        );
    }
}

module.exports = PendingDMHeader;
