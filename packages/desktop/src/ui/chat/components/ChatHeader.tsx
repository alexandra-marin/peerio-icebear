import React from 'react';
import { computed } from 'mobx';
import { observer } from 'mobx-react';
import { chatStore } from 'peerio-icebear';
import T from '~/ui/shared-components/T';
import AvatarWithPopup from '~/ui/contact/components/AvatarWithPopup';
import IdentityVerificationNotice from '~/ui/chat/components/IdentityVerificationNotice';

@observer
export default class ChatHeader extends React.Component {
    @computed
    get displayParticipants() {
        const chat = chatStore.activeChat;
        if (!chat) return [];
        if (chat.isChannel) return chat.allParticipants;
        return chat.otherParticipants;
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
                <T
                    k={
                        chat.isChannel
                            ? 'title_chatBeginningRoom'
                            : 'title_chatBeginning'
                    }
                    tag="div"
                    className="title"
                >
                    {{
                        chatName: chat.name
                    }}
                </T>
                <IdentityVerificationNotice />
            </div>
        );
    }
}
