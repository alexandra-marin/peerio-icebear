import React from 'react';
import { observer } from 'mobx-react';

import { volumeStore } from 'peerio-icebear';
import { Menu, MenuItem, Divider } from 'peer-ui';
import { t } from 'peerio-translator';

import config from '~/config';
import ShareWithMultipleDialog from '~/ui/shared-components/ShareWithMultipleDialog';

import AddOrRenameDialog from './AddOrRenameDialog';
import MoveFileDialog from './MoveFileDialog';

import {
    deleteFileOrFolder,
    downloadFolder,
    isFileOrFolderMoveable
} from '../helpers/sharedFileAndFolderActions';

interface FolderActionsProps {
    folder: any;
    onMenuClick?: () => void;
    onMenuHide?: () => void;
    /**
     * Currently used when Move/Share/Rename dialog has been opened, to affect
     * selection state in parent FileLine
     */
    onActionInProgress?: () => void;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Is the entire action menu disabled? */
    disabled?: boolean;
    deleteDisabled?: boolean;
    shareDisabled?: boolean;
    downloadVisible?: boolean;
    downloadDisabled?: boolean;
}

@observer
export default class FolderActions extends React.Component<FolderActionsProps> {
    private readonly shareWithMultipleDialogRef = React.createRef<
        ShareWithMultipleDialog
    >();
    private readonly moveFileDialogRef = React.createRef<MoveFileDialog>();
    private readonly renameFolderDialogRef = React.createRef<
        AddOrRenameDialog
    >();

    private readonly deleteFolder = () => {
        deleteFileOrFolder(this.props.folder);
    };

    private readonly downloadFolder = () => {
        downloadFolder(this.props.folder);
    };

    private readonly shareFolder = async () => {
        if (this.props.onActionInProgress) this.props.onActionInProgress();
        const f = this.props.folder;

        const contacts = await this.shareWithMultipleDialogRef.current.show(
            f.isShared ? f : null,
            'sharefolders'
        );

        if (!contacts || !contacts.length) return;
        await volumeStore.shareFolder(f, contacts);
    };

    private readonly renameFolder = () => {
        if (this.props.onActionInProgress) this.props.onActionInProgress();
        this.renameFolderDialogRef.current.show(this.props.folder);
    };

    private readonly moveFolder = () => {
        if (this.props.onActionInProgress) this.props.onActionInProgress();
        this.moveFileDialogRef.current.show(
            this.props.folder.parent,
            this.props.folder
        );
    };

    render() {
        const { folder, downloadVisible, downloadDisabled } = this.props;

        const shareVisible: boolean = folder.isShared || folder.canShare;

        return (
            <React.Fragment>
                <Menu
                    className="item-actions"
                    icon="more_vert"
                    position={this.props.position || 'bottom-right'}
                    onClick={this.props.onMenuClick}
                    onHide={this.props.onMenuHide}
                    disabled={this.props.disabled}
                >
                    {shareVisible && config.enableVolumes ? (
                        <MenuItem
                            caption={t('button_share')}
                            icon="person_add"
                            onClick={this.shareFolder}
                            disabled={this.props.shareDisabled}
                        />
                    ) : null}
                    {downloadVisible && (
                        <MenuItem
                            caption={t('title_download')}
                            icon="file_download"
                            onClick={this.downloadFolder}
                            disabled={downloadDisabled}
                        />
                    )}
                    {isFileOrFolderMoveable(folder) && (
                        <MenuItem
                            caption={t('button_move')}
                            className="custom-icon-hover-container"
                            customIcon="move"
                            onClick={this.moveFolder}
                        />
                    )}
                    <MenuItem
                        caption={t('button_rename')}
                        icon="mode_edit"
                        onClick={this.renameFolder}
                    />
                    <Divider />
                    <MenuItem
                        caption={t('button_delete')}
                        icon="delete"
                        onClick={this.deleteFolder}
                        disabled={this.props.deleteDisabled}
                    />
                </Menu>
                <AddOrRenameDialog ref={this.renameFolderDialogRef} />
                <MoveFileDialog ref={this.moveFileDialogRef} />
                <ShareWithMultipleDialog
                    ref={this.shareWithMultipleDialogRef}
                />
            </React.Fragment>
        );
    }
}
