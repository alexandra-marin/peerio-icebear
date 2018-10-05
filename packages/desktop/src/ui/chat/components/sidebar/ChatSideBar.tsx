import React from 'react';
import { observer } from 'mobx-react';
import css from 'classnames';

import { chatStore } from 'peerio-icebear';

import FilesSection from './FilesSection';

@observer
export default class ChatSideBar extends React.Component<{ open: boolean }> {
    render() {
        const chat = chatStore.activeChat;
        if (!chat) return null;
        return (
            <div className={css('chat-sidebar', { open: this.props.open })}>
                <FilesSection open />
            </div>
        );
    }
}
