import React from 'react';
import {
    action,
    computed,
    observable,
    reaction,
    IReactionDisposer
} from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';

import {
    Button,
    CustomIcon,
    Dialog,
    MaterialIcon,
    ProgressBar,
    Tooltip
} from 'peer-ui';
import { chatStore, chatInviteStore } from 'peerio-icebear';
import { t } from 'peerio-translator';

import routerStore from '~/stores/router-store';
import sounds from '~/helpers/sounds';
import uiStore from '~/stores/ui-store';
import beaconStore from '~/stores/beacon-store';

import UserPicker from '~/ui/shared-components/UserPicker';
import FullCoverLoader from '~/ui/shared-components/FullCoverLoader';
import ELEMENTS from '~/whitelabel/helpers/elements';
import ZeroChats from '~/whitelabel/components/ZeroChats';

import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList';
import MessageSideBar from './components/sidebar/MessageSideBar';
import ChatSideBar from './components/sidebar/ChatSideBar';
import ChannelSideBar from './components/sidebar/ChannelSideBar';
import ChatNameEditor from './components/ChatNameEditor';
import ShareToChatProgress from './components/ShareToChatProgress';
import PendingDM from './components/PendingDM';

@observer
export default class ChatView extends React.Component {
    reactionsToDispose!: IReactionDisposer[];

    @observable chatNameEditorVisible = false;
    @observable showUserPicker = false;

    componentDidMount() {
        this.reactionsToDispose = [
            reaction(
                () => chatStore.activeChat,
                () => {
                    this.showUserPicker = false;
                }
            )
        ];

        if (chatInviteStore.activeInvite) {
            routerStore.navigateTo(routerStore.ROUTES.channelInvite);
        }

        ELEMENTS.chatView.checkActiveSpace();

        if (!chatStore.chats.length && !chatInviteStore.received.length) {
            beaconStore.addBeacons('startChat');
        }
    }

    componentWillUnmount() {
        this.reactionsToDispose.forEach(dispose => dispose());
        beaconStore.clearBeacons();
    }

    scrollToBottom(): void {
        if (this.messageListRef.current) {
            this.messageListRef.current.scrollToBottom();
        }
    }

    /**
     * Create a new Message keg with the given plaintext and send it to server as part of this chat.
     * @param text The plaintext of the message.
     */
    sendMessage(text: string): void {
        try {
            chatStore.activeChat
                .sendMessage(text)
                .catch(() => ChatView.playErrorSound());
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Create a new Message keg with the given plaintext and send it to server as part of this chat.
     * @param richText A ProseMirror document tree, in JSON.
     * @param legacyText The rendered HTML of the rich text, for back-compat with older clients
     */
    @action.bound
    sendRichTextMessage(richText: unknown, legacyText: string): void {
        try {
            this.scrollToBottom();
            chatStore.activeChat
                .sendRichTextMessage(richText, legacyText)
                .catch(() => ChatView.playErrorSound());
        } catch (err) {
            console.error(err);
        }
    }

    @action.bound
    sendAck(): void {
        try {
            this.scrollToBottom();
            chatStore.activeChat
                .sendAck()
                .catch(() => ChatView.playErrorSound());
        } catch (err) {
            console.error(err);
        }
    }

    @action.bound
    shareFilesAndFolders(filesAndFolders) {
        try {
            this.scrollToBottom();
            chatStore.activeChat
                .shareFilesAndFolders(filesAndFolders)
                .catch(() => ChatView.playErrorSound());
        } catch (err) {
            console.error(err);
        }
    }

    addParticipants = contacts => {
        chatStore.activeChat.addParticipants(contacts);
        this.closeUserPicker();
    };

    static playErrorSound() {
        if (uiStore.prefs.errorSoundsEnabled) sounds.destroy.play();
    }

    openUserPicker = () => {
        this.showUserPicker = true;
    };

    closeUserPicker = () => {
        this.showUserPicker = false;
    };

    toggleSidebar = () => {
        uiStore.prefs.chatSideBarIsOpen = !uiStore.prefs.chatSideBarIsOpen;
        uiStore.selectedMessage = null;
    };

    showChatNameEditor = () => {
        if (!(chatStore.activeChat.canIAdmin && chatStore.activeChat.isChannel))
            return;
        this.chatNameEditorVisible = true;
    };

    hideChatNameEditor = () => {
        this.chatNameEditorVisible = false;
    };

    chatNameEditorRef = ref => {
        if (ref) ref.nameInput.focus();
    };

    @observable jitsiDialogVisible = false;
    toggleJitsiDialog = () => {
        this.jitsiDialogVisible = !this.jitsiDialogVisible;
    };

    postJitsiLink = () => {
        const jitsiLink = chatStore.generateJitsiUrl();
        chatStore.activeChat && chatStore.activeChat.createVideoCall(jitsiLink);

        this.toggleJitsiDialog();
    };

    @computed
    get shareInProgress() {
        const chat = chatStore.activeChat;
        if (!chat) return false;
        return (
            (chat.uploadQueue && chat.uploadQueue.length) ||
            (chat.folderShareQueue && chat.folderShareQueue.length)
        );
    }

    // assumes active chat exists, don't render if it doesn't
    renderHeader() {
        const chat = chatStore.activeChat;
        const participants = chat.participantUsernames;

        let listMembers = participants[0];
        for (let i = 1; i < participants.length; i++) {
            if (`${listMembers}, ${participants[i]}`.length < 100) {
                listMembers += `, ${participants[i]}`;
            } else {
                listMembers += ' ...';
                break;
            }
        }

        return (
            <div className="message-toolbar">
                <div className="message-toolbar-inner">
                    <div className="title" onClick={this.showChatNameEditor}>
                        {this.chatNameEditorVisible ? (
                            <ChatNameEditor
                                showLabel={false}
                                className="name-editor"
                                readOnly={!chat.canIAdmin}
                                onBlur={this.hideChatNameEditor}
                            />
                        ) : (
                            <div className="name-editor-inner">
                                {chat.canIAdmin && chat.isChannel ? (
                                    <MaterialIcon icon="edit" />
                                ) : null}
                                {chat.isChannel ? (
                                    ELEMENTS.chatView.title(
                                        ELEMENTS.chatEditor.displayName(chat)
                                    )
                                ) : (
                                    <div className="title-content">
                                        {chat.name}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="meta-nav">
                        {chat.isChannel ? (
                            <div className="member-count">
                                <MaterialIcon
                                    icon="person"
                                    tooltip={listMembers}
                                    tooltipPosition="bottom"
                                />
                                {chat.allParticipants.length || ''}
                            </div>
                        ) : chat.changingFavState ? (
                            <ProgressBar
                                type="circular"
                                mode="indeterminate"
                                size="small"
                            />
                        ) : (
                            <div
                                onClick={chat.toggleFavoriteState}
                                className={css(
                                    'pin-toggle',
                                    'clickable',
                                    'custom-icon-hover-container'
                                )}
                            >
                                <CustomIcon
                                    active={chat.isFavorite}
                                    icon={
                                        chat.isFavorite ? 'pin-on' : 'pin-off'
                                    }
                                    className="small"
                                    hover={!chat.isFavorite}
                                />
                                <Tooltip
                                    text={
                                        chat.isFavorite
                                            ? t('button_unpinChat')
                                            : t('button_pinChat')
                                    }
                                    position="bottom"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="message-toolbar-inner-right">
                    <Button
                        icon="videocam"
                        disabled={!chat || !chat.canSendJitsi}
                        onClick={this.toggleJitsiDialog}
                        tooltip={t('button_startVideoCall')}
                        tooltipPosition="bottom"
                        tooltipSize="small"
                    />
                    <Button
                        icon="chrome_reader_mode"
                        onClick={this.toggleSidebar}
                        active={uiStore.prefs.chatSideBarIsOpen}
                        tooltip={t('button_toggleSidebar')}
                        tooltipPosition="bottom"
                        tooltipSize="small"
                    />
                </div>
            </div>
        );
    }

    get sidebar() {
        if (!chatStore.activeChat) return null;
        if (uiStore.selectedMessage) {
            return <MessageSideBar />;
        }
        return chatStore.activeChat.isChannel ? (
            <ChannelSideBar
                open={uiStore.prefs.chatSideBarIsOpen}
                onAddParticipants={this.openUserPicker}
            />
        ) : (
            <ChatSideBar open={uiStore.prefs.chatSideBarIsOpen} />
        );
    }

    @observable.ref messageListRef = React.createRef<MessageList>();

    jumpToBottom = () => {
        const chat = chatStore.activeChat;

        if (chat.canGoDown) {
            chat.reset();
            return;
        }

        this.scrollToBottom();
    };

    @computed
    get pageScrolledUp() {
        return (
            this.messageListRef.current &&
            this.messageListRef.current.pageScrolledUp
        );
    }

    render() {
        if (!chatStore.chats.length && !chatInviteStore.received.length) {
            return <ZeroChats />;
        }

        const chat = chatStore.activeChat;
        if (!chat) return null;

        if (chat.isInvite) {
            return <PendingDM />;
        }

        const jitsiActions = [
            { label: t('button_cancel'), onClick: this.toggleJitsiDialog },
            { label: t('button_startVideoCall'), onClick: this.postJitsiLink }
        ];

        return (
            <div className="message-view">
                {this.renderHeader()}
                <div className="messages-and-sidebar-container">
                    {this.showUserPicker ? (
                        <div className="create-new-chat">
                            <UserPicker
                                closeable
                                onClose={this.closeUserPicker}
                                onAccept={this.addParticipants}
                                exceptContacts={chat.allParticipants}
                                title={t('title_addParticipants')}
                                noDeleted
                                context={ELEMENTS.chatView.currentContext}
                            />
                        </div>
                    ) : (
                        <div className="messages-container">
                            {chatStore.chats.length === 0 &&
                            !chatStore.loading ? null : (
                                <MessageList ref={this.messageListRef} />
                            )}
                            {this.shareInProgress ? (
                                <ShareToChatProgress
                                    uploadQueue={chat.uploadQueue}
                                    folderShareQueue={chat.folderShareQueue}
                                />
                            ) : null}
                            <MessageInput
                                readonly={
                                    !chat || !chat.metaLoaded || chat.isReadOnly
                                }
                                placeholder={
                                    chat
                                        ? t('title_messageInputPlaceholder', {
                                              chatName: `${
                                                  chat.isChannel ? '# ' : ''
                                              }${chat.name}`
                                          })
                                        : null
                                }
                                onSend={this.sendRichTextMessage}
                                onAck={this.sendAck}
                                onFileShare={this.shareFilesAndFolders}
                                messageListScrolledUp={this.pageScrolledUp}
                                onJumpToBottom={this.jumpToBottom}
                                shareInProgress={this.shareInProgress}
                            />
                        </div>
                    )}
                    {this.sidebar}
                </div>
                {chat.leaving ? <FullCoverLoader show /> : null}
                <Dialog
                    active={this.jitsiDialogVisible}
                    actions={jitsiActions}
                    onCancel={this.toggleJitsiDialog}
                    title={t('title_videoCall')}
                >
                    {t('dialog_videoCall')}
                </Dialog>
            </div>
        );
    }
}
