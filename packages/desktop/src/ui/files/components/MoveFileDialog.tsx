import React from 'react';
import {
    observable,
    action,
    computed,
    reaction,
    IReactionDisposer
} from 'mobx';
import { observer } from 'mobx-react';
import { t } from 'peerio-translator';
import { Button, Dialog, MaterialIcon } from 'peer-ui';
import { fileStore } from 'peerio-icebear';
import Search from '~/ui/shared-components/Search';
import css from 'classnames';
import ShareConfirmDialog from './ShareConfirmDialog';

// HACK: circular require :(
let Breadcrumb; // : typeof import('./Breadcrumb').default; // FIXME: not supported by @babel/preset-typescript yet
setTimeout(() => {
    Breadcrumb = require('./Breadcrumb').default;
});

@observer
export default class MoveFileDialog extends React.Component {
    /*
     * The Move File dialog allows users to select a destination folder either
     * by navigating into it (the `currentFolder` field) or selecting it from a
     * list of folders in the current folder (the `selectedFolder` field).
     *
     * TODO/UX: changing folders should probably clear the selection, and/or
     * there should be always-visible feedback of the current destination folder
     * (eg. a line at the bottom of the dialog saying "2 files will be moved to
     * foldername")
     */

    @observable selectedFolder: any | null = null; // TODO/TS: icebear model

    @observable currentFolder!: any; // should be assigned on show()

    /**
     * Reference to the promise resolver for returning the dialog result. When
     * the resolver is set to null, the dialog is hidden.
     */
    @observable.ref private resolver: (() => void) | null = null;

    disposer!: IReactionDisposer;

    itemToMove: any;

    @observable query = '';

    shareConfirmDialogRef = React.createRef<ShareConfirmDialog>();
    dialogRef = React.createRef<Dialog>();

    /**
     * @param itemToMove If undefined, we're performing a bulk move based
     *                   on selected files and folders.
     */
    @action.bound
    show(initialFolder: any, itemToMove?: any) {
        this.currentFolder = initialFolder;
        this.itemToMove = itemToMove;

        this.disposer = reaction(
            () => this.currentFolder.isDeleted,
            isDeleted => {
                if (isDeleted) this.currentFolder = fileStore.folderStore.root;
            }
        );

        return new Promise<void>(res => {
            this.resolver = res;
        });
    }

    @action.bound
    close() {
        this.resolver();
        this.resolver = null;
        this.itemToMove = null;
        this.currentFolder = null;
        this.selectedFolder = null;
        this.disposer();
    }

    @computed
    get legacyFileSelected(): boolean {
        return (
            (this.itemToMove && this.itemToMove.isLegacy) ||
            fileStore.bulk.hasLegacyObjectsSelected
        );
    }

    @action.bound
    async performMove() {
        const targetFolder = this.selectedFolder || this.currentFolder;

        // It should not be possible via UI to move a legacy file to a shared folder
        // If it happens somehow, we'll log an error.
        if (this.legacyFileSelected && targetFolder.isShared) {
            console.error('Cannot move legacy files to a shared folder');
            this.close();
            return;
        }

        if (targetFolder.root.isShared) {
            // we hide folder selection dialog immediately to prevent flicker
            this.dialogRef.current.hideWithoutAnimation();
            if (!(await this.shareConfirmDialogRef.current.check())) {
                // if user pressed cancel on confirmation, we show our dialog immediately
                // to prevent flicker again
                this.dialogRef.current.showWithoutAnimation();
                return;
            }
        }

        if (this.itemToMove) {
            fileStore.bulk.moveOne(this.itemToMove, targetFolder);
        } else {
            fileStore.bulk.move(targetFolder);
        }
        this.close();
    }

    @computed
    get visibleFolders() {
        let visibleFolders = this.query
            ? fileStore.foldersFiltered(this.query)
            : this.currentFolder.foldersSortedByName;

        if (this.itemToMove && this.itemToMove.isFolder) {
            visibleFolders = visibleFolders.filter(f => f !== this.itemToMove);
        }

        return visibleFolders.map(f => (
            <FolderRow
                key={f.id}
                folder={f}
                disabled={f.isShared && this.legacyFileSelected}
                isSelected={f === this.selectedFolder}
                onEnter={this.setCurrentFolder}
                onSelect={this.setSelectedFolder}
            />
        ));
    }

    @action.bound
    handleSearch(val) {
        this.query = val;
    }

    @action.bound
    setCurrentFolder(folder) {
        this.currentFolder = folder;
    }

    @action.bound
    setSelectedFolder(folder) {
        this.selectedFolder = folder;
    }

    render() {
        if (!this.resolver) return null;

        const actions = [
            { label: t('button_cancel'), onClick: this.close },
            { label: t('button_move'), onClick: this.performMove }
        ];

        return (
            <div>
                <ShareConfirmDialog ref={this.shareConfirmDialogRef} />
                <Dialog
                    active
                    ref={this.dialogRef}
                    actions={actions}
                    onCancel={this.close}
                    title={t('title_moveFileTo')}
                    className="move-file-dialog"
                >
                    <Search onChange={this.handleSearch} query={this.query} />
                    <Breadcrumb
                        folder={this.currentFolder}
                        onFolderClick={this.setCurrentFolder}
                        noActions
                        noSelectionCounter
                    />
                    <div className="move-folders-container">
                        {this.visibleFolders}
                    </div>
                </Dialog>
            </div>
        );
    }
}

interface FolderRowProps {
    folder: any;
    isSelected: boolean;
    disabled: boolean;
    onSelect: (folder: any) => void;
    onEnter: (folder: any) => void;
}

@observer
class FolderRow extends React.Component<FolderRowProps> {
    handleSelect = () => {
        this.props.onSelect(this.props.folder);
    };

    handleEnter = () => {
        this.props.onEnter(this.props.folder);
    };

    render() {
        const { folder, isSelected, disabled } = this.props;

        const hasFolders = folder.folders.length > 0;

        return (
            <div
                key={`folder-${folder.id}`}
                data-folderid={folder.id}
                data-storeid={folder.store.id}
                className={css('move-file-row', { disabled })}
            >
                <Button
                    icon={
                        isSelected
                            ? 'radio_button_checked'
                            : 'radio_button_unchecked'
                    }
                    onClick={this.handleSelect}
                    theme="small"
                    selected={isSelected}
                    disabled={disabled}
                />
                <MaterialIcon
                    icon={folder.isShared ? 'folder_shared' : 'folder'}
                    className="folder-icon"
                />
                <div
                    className={css('file-info', { clickable: hasFolders })}
                    onClick={disabled ? null : this.handleEnter}
                >
                    <div
                        className={css('file-name', {
                            clickable: hasFolders && !disabled
                        })}
                    >
                        {folder.name}
                    </div>
                </div>
                {hasFolders && (
                    <Button
                        onClick={this.handleEnter}
                        icon="keyboard_arrow_right"
                        theme="small"
                        disabled={disabled}
                    />
                )}
            </div>
        );
    }
}
