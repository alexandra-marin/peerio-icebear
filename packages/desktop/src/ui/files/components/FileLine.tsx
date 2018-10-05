import React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';
import moment from 'moment';
import css from 'classnames';

import { contactStore, fileStore, User } from 'peerio-icebear';
import { t } from 'peerio-translator';
import { Checkbox, ProgressBar, Tooltip } from 'peer-ui';

import T from '~/ui/shared-components/T';
import ContactProfile from '~/ui/contact/components/ContactProfile';
import FileSpriteIcon from '~/ui/shared-components/FileSpriteIcon';

import { downloadFile } from '~/helpers/file';
import uiStore from '~/stores/ui-store';

import FileActions from './FileActions';
import FileFolderDetailsRow from './FileFolderDetailsRow';
import { isFileOwnedByCurrentUser } from '../helpers/sharedFileAndFolderActions';

interface FileLineProps {
    file: any; // TODO:TS
    checkbox: boolean;
    isDragging?: boolean;
    className?: string;
    clickToSelect?: true;
    fileDetails?: true;
    fileDetailsMini?: boolean;
    fileActions?: true;
}

@observer
export default class FileLine extends React.Component<FileLineProps> {
    // 21 hour limit for displaying relative timestamp (because moment.js says '1 day' starting from 21h)
    static readonly relativeTimeDisplayLimit = 21 * 60 * 60 * 1000;

    @observable hovered = false;

    @observable clickedContact; // TODO/TS: icebear contact

    readonly contactProfileRef = React.createRef<ContactProfile>();

    @action.bound
    onMenuClick() {
        this.hovered = true;
    }

    @action.bound
    onMenuHide() {
        this.hovered = false;
    }

    // When dialog is opened by FileActions menu, clear the selection and select only this file
    readonly onActionInProgress = () => {
        fileStore.clearSelection();
        this.toggleSelected();
    };

    // Most actions will clear file selection on their own, but this will handle actions that don't.
    onActionComplete() {
        fileStore.clearSelection();
    }

    readonly cancelUploadOrDownload = () => {
        this.props.file.cancelUpload();
        this.props.file.cancelDownload();
    };

    readonly download = () => {
        downloadFile(this.props.file);
    };

    readonly deleteFile = () => {
        let msg = t('title_confirmRemoveFilename', {
            name: this.props.file.name
        });
        if (
            this.props.file.shared &&
            isFileOwnedByCurrentUser(this.props.file)
        ) {
            msg += `\n\n${t('title_confirmRemoveSharedFiles')}`;
        }
        if (confirm(msg)) {
            this.props.file.remove();
        }
    };

    @action.bound
    toggleSelected() {
        this.props.file.selected = !this.props.file.selected;
    }

    @action.bound
    openContact() {
        this.clickedContact = contactStore.getContact(
            this.props.file.fileOwner
        );
        this.contactProfileRef.current.openDialog();
    }

    render() {
        const { file, isDragging } = this.props;

        // We want relative timestamp in case it's not older then 1 day.
        // In case of relative timestamp we also want to re-render periodically to update it
        let uploadedAt, uploadedAtTooltip;

        if (file.uploadedAt) {
            // if file timestamp is past the limit...
            if (
                Date.now() - file.uploadedAt >
                FileLine.relativeTimeDisplayLimit
            ) {
                uploadedAt = file.uploadedAt.toLocaleString();
                // this condition is always true and we need it only to subscribe to clock updates
            } else if (uiStore.minuteClock.now) {
                uploadedAt = moment(file.uploadedAt).fromNow();
                uploadedAtTooltip = file.uploadedAt.toLocaleString();
            }
        }

        return (
            /*
                This superfluous row-container is needed to make styles consistent with FolderLine,
                which *does* need the container to hold elements other than .row
            */
            <div
                className={css(
                    'row-container',
                    'file-row-container',
                    this.props.className,
                    {
                        hover: this.hovered,
                        selected: file.selected,
                        'selected-row': file.selected,
                        'waiting-3rd-party':
                            !file.uploading && !file.readyForDownload,
                        'dragged-row': isDragging
                    }
                )}
            >
                <div className="row">
                    {this.props.checkbox ? (
                        <Checkbox
                            className="file-checkbox"
                            checked={file.selected}
                            onChange={this.toggleSelected}
                        />
                    ) : (
                        <div className="file-checkbox" />
                    )}

                    <div
                        className="file-icon"
                        onClick={
                            this.props.clickToSelect
                                ? this.toggleSelected
                                : this.download
                        }
                    >
                        <FileSpriteIcon type={file.iconType} size="medium" />
                    </div>

                    <div
                        className="file-name"
                        onClick={
                            this.props.clickToSelect
                                ? this.toggleSelected
                                : this.download
                        }
                    >
                        {file.name}

                        {this.props.fileDetailsMini && (
                            <FileFolderDetailsRow file={file} />
                        )}
                    </div>

                    {this.props.fileDetails && (
                        <div
                            className="file-owner clickable"
                            onClick={this.openContact}
                        >
                            {file.fileOwner === User.current.username
                                ? `${t('title_you')}`
                                : file.fileOwner}
                        </div>
                    )}

                    {this.props.fileDetails && (
                        <div
                            className="file-uploaded"
                            title={uploadedAtTooltip}
                        >
                            {uploadedAt}
                            {file.isLegacy && (
                                <div className="badge-old-version">
                                    <T k="title_pending" />
                                    <Tooltip
                                        text={t('title_oldVersionTooltip')}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {this.props.fileDetails && (
                        <div className="file-size">{file.sizeFormatted}</div>
                    )}

                    {this.props.fileActions && (
                        <div className="file-actions">
                            <FileActions
                                file={file}
                                onMenuClick={this.onMenuClick}
                                onMenuHide={this.onMenuHide}
                                onActionInProgress={this.onActionInProgress}
                                onActionComplete={this.onActionComplete}
                                onDelete={this.deleteFile}
                            />
                        </div>
                    )}
                </div>

                {file.downloading || file.uploading ? (
                    <ProgressBar
                        type="linear"
                        mode="determinate"
                        value={file.progress}
                        max={file.progressMax}
                    />
                ) : null}

                {this.props.fileDetails && (
                    <ContactProfile
                        ref={this.contactProfileRef}
                        contact={this.clickedContact}
                    />
                )}
            </div>
        );
    }
}
