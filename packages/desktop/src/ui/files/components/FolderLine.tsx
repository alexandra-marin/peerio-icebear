import React from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';

import { t } from 'peerio-translator';
import { User, contactStore, fileStore } from 'peerio-icebear';
import {
    Button,
    Checkbox,
    CustomIcon,
    MaterialIcon,
    ProgressBar
} from 'peer-ui';

import ContactProfile from '~/ui/contact/components/ContactProfile';
import T from '~/ui/shared-components/T';

import FolderActions from './FolderActions';
import FileFolderDetailsRow from './FileFolderDetailsRow';
import { setCurrentFolder } from '../helpers/sharedFileAndFolderActions';

export interface FolderLineProps {
    folder: any; // FIXME/TS: need icebear types
    checkbox: boolean;
    disabledCheckbox?: boolean;
    className?: string;
    folderDetails?: true;
    folderDetailsMini?: boolean;
    folderActions?: true;
    isDragging?: boolean;
    isBeingDraggedOver?: boolean;
    canBeDroppedInto?: boolean;
    showNavigation?: boolean;
}

@observer
export default class FolderLine extends React.Component<FolderLineProps> {
    contactProfileRef = React.createRef<ContactProfile>();

    @observable hovered;

    @action.bound
    onMenuClick(): void {
        this.hovered = true;
    }
    @action.bound
    onMenuHide(): void {
        this.hovered = false;
    }

    onClickFolder = (): void => {
        setCurrentFolder(this.props.folder);
    };

    @action.bound
    toggleSelected(): void {
        this.props.folder.selected = !this.props.folder.selected;
    }

    onActionInProgress = (): void => {
        fileStore.clearSelection();
        this.toggleSelected();
    };

    @observable clickedContact; // FIXME/TS: need icebear type
    @action.bound
    openContact(): void {
        this.clickedContact = contactStore.getContact(this.props.folder.owner);
        this.contactProfileRef.current.openDialog();
    }

    render() {
        const {
            folder,
            isDragging,
            isBeingDraggedOver,
            canBeDroppedInto,
            showNavigation
        } = this.props;

        const selectDisabled = this.props.disabledCheckbox;
        const { progress, progressMax, progressPercentage } = folder;
        const shareInProgress =
            folder.convertingToVolume || folder.convertingFromFolder;

        return (
            <div
                data-folderid={folder.id}
                data-storeid={folder.store.id}
                className={css(
                    'row-container',
                    'folder-row-container',
                    'custom-icon-hover-container',
                    this.props.className,
                    {
                        hover: this.hovered,
                        'selected-row': folder.selected,
                        'share-in-progress': shareInProgress,
                        'dragged-row': isDragging,
                        'folder-row-droppable-hovered':
                            isBeingDraggedOver && canBeDroppedInto
                    }
                )}
            >
                <div className="row">
                    {shareInProgress ? (
                        <div className="file-checkbox percent-progress">
                            {`${progressPercentage}%`}
                        </div>
                    ) : this.props.checkbox ? (
                        <Checkbox
                            className={css('file-checkbox', {
                                disabled: selectDisabled
                            })}
                            checked={folder.selected}
                            onChange={
                                selectDisabled ? null : this.toggleSelected
                            }
                        />
                    ) : (
                        <div className="file-checkbox" />
                    )}

                    <div className="file-icon" onClick={this.onClickFolder}>
                        {folder.canShare ? (
                            <MaterialIcon icon="folder" />
                        ) : (
                            <CustomIcon
                                icon="folder-shared"
                                hover
                                selected={folder.selected}
                            />
                        )}
                    </div>

                    <div
                        className="file-name clickable selectable"
                        onClick={this.onClickFolder}
                    >
                        {folder.name}

                        {this.props.folderDetailsMini && (
                            <FileFolderDetailsRow folder={folder} />
                        )}
                    </div>

                    {this.props.folderDetails && (
                        <div
                            className="file-owner clickable"
                            onClick={this.openContact}
                        >
                            {shareInProgress ? (
                                <T k="title_convertingToShared" />
                            ) : folder.owner === User.current.username ? (
                                t('title_you')
                            ) : (
                                folder.owner
                            )}
                        </div>
                    )}

                    {this.props.folderDetails && (
                        <div className="file-uploaded" />
                    )}

                    {this.props.folderDetails && <div className="file-size" />}

                    {this.props.folderActions && (
                        <div className="file-actions">
                            <FolderActions
                                folder={folder}
                                deleteDisabled={shareInProgress}
                                onMenuClick={this.onMenuClick}
                                onMenuHide={this.onMenuHide}
                                onActionInProgress={this.onActionInProgress}
                            />
                        </div>
                    )}

                    {showNavigation && (
                        <Button
                            icon="keyboard_arrow_right"
                            onClick={this.onClickFolder}
                        />
                    )}
                </div>

                {shareInProgress && (
                    <div className="row sub-row">
                        <div className="file-checkbox" />

                        <div className="file-icon">
                            <CustomIcon icon="stacked-files" hover />
                        </div>

                        <div className="file-name">
                            <T k="title_filesInQueue" />
                        </div>

                        <div className="file-owner">
                            <T k="title_sharingFiles" />
                        </div>

                        <div className="file-uploaded" />
                        <div className="file-size" />
                        <div className="file-actions" />
                    </div>
                )}

                {shareInProgress && (
                    <ProgressBar
                        type="linear"
                        mode="determinate"
                        value={progress}
                        max={progressMax}
                    />
                )}

                {this.props.folderDetails && (
                    <ContactProfile
                        ref={this.contactProfileRef}
                        contact={this.clickedContact}
                    />
                )}
            </div>
        );
    }
}
