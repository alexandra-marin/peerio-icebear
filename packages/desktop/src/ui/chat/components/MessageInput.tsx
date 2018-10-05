import fs from 'fs';
import os from 'os';
import path from 'path';

import React from 'react';
import { computed, observable, action } from 'mobx';
import { observer } from 'mobx-react';
import { debounce } from 'lodash';

import css from 'classnames';
import { t } from 'peerio-translator';
import { fileStore, chatStore, clientApp } from 'peerio-icebear';
import { Button, MaterialIcon, Menu, MenuItem } from 'peer-ui';

import FilePicker from '~/ui/files/components/FilePicker';
import Snackbar from '~/ui/shared-components/Snackbar';
import { pickLocalFiles, getFileList } from '~/helpers/file';
import UploadDialog from '~/ui/shared-components/UploadDialog';

import MessageInputProseMirror from './MessageInputProseMirror';

interface MessageInputProps {
    readonly: boolean;
    placeholder: string;
    onSend: (richText: Object, legacyText: string) => void;
    onAck: () => void;
    onFileShare: (files: any) => void; // TODO: TS audit
    messageListScrolledUp: boolean;
    shareInProgress: boolean;
    onJumpToBottom: () => void;
}

@observer
export default class MessageInput extends React.Component<MessageInputProps> {
    @observable filePickerActive = false;

    @observable uploadDialogActive = false;
    @observable.shallow selectedFiles: string[] = [];

    @action.bound
    async activateUploadDialog() {
        const chat = chatStore.activeChat;
        if (!chat) return;
        const files = await pickLocalFiles();
        if (!files || !files.length) return;
        this.uploadDialogActive = true;
        const paths = await getFileList(files);
        if (!paths || !paths.success || !paths.success.length) {
            this.uploadDialogActive = false;
            return;
        }
        this.selectedFiles = paths.success;
    }

    @action.bound
    deactivateUploadDialog() {
        this.uploadDialogActive = false;
        this.selectedFiles = [];
    }

    /**
     * Drag-and-drop is handled by another component higher in the hierarchy,
     * so we use this event handler to ensure drops aren't caught in our input field.
     */
    preventDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        return false;
    };

    handleFilePickerClose = () => {
        this.filePickerActive = false;
    };

    // TODO: TS audit
    shareFiles = (selected: any) => {
        this.props.onFileShare(selected);
        this.handleFilePickerClose();
    };

    showFilePicker = () => {
        fileStore.clearSelection();
        this.filePickerActive = true;
    };

    onPaste = (ev: React.ClipboardEvent<HTMLDivElement>) => {
        const chat = chatStore.activeChat;
        if (!chat) return;
        const { items } = ev.clipboardData;
        for (let i = 0; i < items.length; i++) {
            if (!items[i].type.startsWith('image/')) continue;
            const blob = items[i].getAsFile();
            if (!blob) return;
            ev.preventDefault();
            ev.stopPropagation();
            const reader = new FileReader();
            if (!confirm(t('title_uploadPastedFile'))) break;
            const tmpPath = path.join(
                os.tmpdir(),
                `peerio-${Date.now()}.${items[i].type.split('/')[1]}`
            );

            reader.onloadend = () => {
                const buffer = Buffer.from(reader.result as ArrayBuffer);
                fs.writeFile(tmpPath, buffer, {}, err => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    chat.uploadAndShareFile(tmpPath, '', true);
                });
            };
            reader.readAsArrayBuffer(blob);
            break;
        }
    };

    renderFilePicker() {
        return (
            <FilePicker
                active={this.filePickerActive}
                onClose={this.handleFilePickerClose}
                onShare={this.shareFiles}
                hideLegacy
            />
        );
    }

    @observable snackbarRef!: Snackbar;
    @observable wheelOverJumpToBottom = false;
    @action.bound
    setSnackbarRef(ref: Snackbar | null) {
        if (ref) this.snackbarRef = ref;
    }

    @computed
    get snackbarVisible() {
        if (this.snackbarRef) return this.snackbarRef.isVisible;
        return false;
    }

    @computed
    get jumpToBottomVisible() {
        return (
            !this.wheelOverJumpToBottom &&
            (this.props.messageListScrolledUp ||
                chatStore.activeChat.canGoDown ||
                (!clientApp.isReadingNewestMessages &&
                    chatStore.activeChat.unreadCount > 0))
        );
    }

    cancelWheelOverJumpToBottom = debounce(() => {
        this.wheelOverJumpToBottom = false;
    }, 1000);

    handleWheelOverJumpToBottom = () => {
        this.wheelOverJumpToBottom = true;
        this.cancelWheelOverJumpToBottom();
    };

    renderJumpToBottom() {
        if (!this.jumpToBottomVisible) return null;
        const chat = chatStore.activeChat;
        return (
            <div
                className={css('jump-to-bottom', {
                    'snackbar-visible': this.snackbarVisible,
                    'share-in-progress': this.props.shareInProgress
                })}
                onWheel={this.handleWheelOverJumpToBottom}
            >
                <Button
                    icon="keyboard_arrow_down"
                    onClick={this.props.onJumpToBottom}
                />
                {chat.unreadCount > 0 && (
                    <div className="unread-badge">
                        {chat.unreadCount < 100 ? chat.unreadCount : '99+'}
                    </div>
                )}
            </div>
        );
    }

    render() {
        if (this.uploadDialogActive) {
            return (
                <UploadDialog
                    deactivate={this.deactivateUploadDialog}
                    files={this.selectedFiles}
                />
            );
        }
        const chat = chatStore.activeChat;
        return (
            <div className="message-input-wrapper">
                <Snackbar
                    className={css('snackbar-chat', {
                        'share-in-progress': this.props.shareInProgress
                    })}
                    ref={this.setSnackbarRef}
                />
                <div
                    className="message-input"
                    onDrop={this.preventDrop}
                    onPaste={this.onPaste}
                >
                    <Menu
                        position="bottom-left"
                        icon="add_circle_outline"
                        tooltip={t('title_shareToChat')}
                    >
                        <MenuItem
                            value="share"
                            caption={t('title_shareFromFiles')}
                            onClick={this.showFilePicker}
                        />
                        <MenuItem
                            value="upload"
                            caption={t('title_uploadAndShare')}
                            onClick={this.activateUploadDialog}
                        />
                    </Menu>

                    {this.props.readonly ? (
                        <div className="message-editor-empty">&nbsp;</div>
                    ) : (
                        <MessageInputProseMirror
                            placeholder={this.props.placeholder}
                            onSend={this.props.onSend}
                        />
                    )}
                    <Button
                        disabled={!chat || !chat.canSendAck}
                        icon="thumb_up"
                        onClick={this.props.onAck}
                        className="thumbs-up"
                        tooltip={t('button_thumbsUp')}
                        tooltipSize="small"
                        theme="no-hover"
                    />

                    {this.renderFilePicker()}
                    {this.renderJumpToBottom()}
                </div>
                {this.props.readonly ? <div className="backdrop" /> : null}
            </div>
        );
    }
}
