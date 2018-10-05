import React from 'react';
import { computed, observable, reaction, IReactionDisposer } from 'mobx';
import { observer } from 'mobx-react';

import { fileStore } from 'peerio-icebear';
import { t } from 'peerio-translator';
import { MaterialIcon } from 'peer-ui';

import T from '~/ui/shared-components/T';

import FolderActions from './FolderActions';

// hardcoded, need to change if font stack changes!
const FONT_DEF_FOR_MEASUREMENT = '600 20px Open Sans';
const FOLDER_MAX_WIDTH = 120;

interface BreadcrumbProps {
    /** The folder we're breadcrumbing. */
    folder: any; // TODO/TS: icebear model
    onFolderClick: (folder: any) => void; // TODO/TS: icebear model
    noActions?: boolean;
    noSelectionCounter?: boolean;
}

@observer
export default class Breadcrumb extends React.Component<BreadcrumbProps> {
    _watchFolder!: IReactionDisposer;

    @computed
    get folderPath() {
        const folderPath = []; // TODO/TS: icebear model
        let iterator = this.props.folder;
        do {
            folderPath.unshift(iterator);
            iterator = iterator.parent;
        } while (iterator);
        return folderPath;
    }

    componentDidMount() {
        this._watchFolder = reaction(
            () => this.props.folder,
            this.ellipsizeFolderNames,
            true
        );
        window.addEventListener('resize', this.ellipsizeFolderNames, false);
    }

    componentWillUnmount() {
        this._watchFolder();
        window.removeEventListener('resize', this.ellipsizeFolderNames);
    }

    // Total combined current widths of text, before replacing folder names with ellipses
    @computed
    get folderWidths() {
        const array: string[] = [];
        this.folderPath.forEach(folder => {
            folder.name
                ? array.push(folder.name)
                : array.push(t('title_files'));
        });

        return this.calcTextWidths(array);
    }

    // Folders, by index, that will be ellipsized
    @observable foldersToEllipsize = -1;

    // Actual current widths, after replacing folder names with ellipses
    @computed
    get folderWidthsWithEllipsized(): number[] {
        const array: string[] = [];
        this.folderPath.forEach(folder => {
            folder.name
                ? array.push(folder.name)
                : array.push(t('title_files'));
        });

        for (let i = 0; i <= this.foldersToEllipsize; i++) {
            array[i] = '...';
        }

        return this.calcTextWidths(array);
    }

    // Takes array of folder names, return array of the widths of those names
    calcTextWidths(array: string[]): number[] {
        const context = document.createElement('canvas').getContext('2d');
        context.font = FONT_DEF_FOR_MEASUREMENT;

        const widthArray: number[] = [];

        array.forEach(folder => {
            const thisWidth = context.measureText(folder).width;
            widthArray.push(
                thisWidth < FOLDER_MAX_WIDTH ? thisWidth : FOLDER_MAX_WIDTH
            );
        });

        return widthArray;
    }

    // Used to calculate total actual width of folder names, including ellipsized names
    @computed
    get totalWidth(): number {
        const context = document.createElement('canvas').getContext('2d');
        context.font = FONT_DEF_FOR_MEASUREMENT;

        let totalWidth = 0;

        this.folderWidthsWithEllipsized.forEach(width => {
            totalWidth += width < FOLDER_MAX_WIDTH ? width : FOLDER_MAX_WIDTH;
        });

        // Add width of icons (hardcoded at 32px right now)
        totalWidth += 32 * (this.folderWidthsWithEllipsized.length - 1);

        return totalWidth;
    }

    ellipsizeFolderNames = () => {
        const breadcrumbContainer = document.getElementsByClassName(
            'breadcrumb-container'
        )[0];

        // 48px subtracted to take into account the width of the three-dots button
        // 32px subtracted to take into account the left margin of the breadcrumb
        const containerWidth =
            parseInt(
                window
                    .getComputedStyle(breadcrumbContainer)
                    .getPropertyValue('width'),
                10
            ) -
            48 -
            32;

        while (
            this.totalWidth > containerWidth &&
            this.foldersToEllipsize < this.folderPath.length
        ) {
            this.foldersToEllipsize++;
        }

        // A "catch" for navigating up the folderPath, so that the folderWidth[] below doesn't end up undefined
        if (this.folderPath.length - 1 < this.foldersToEllipsize) {
            this.foldersToEllipsize = this.folderPath.length - 1;
        }

        /* Compare folder name width vs ellipsis width. Compare breadcrumb container width vs current breadcrumb width.
         * If folder name will not overflow breadcrumb container, then replace ellipsis with folder name.
         * Repeat until the folder name WOULD overflow breadcrumb container.
         */
        while (
            this.folderWidths[this.foldersToEllipsize] -
                this.folderWidthsWithEllipsized[this.foldersToEllipsize] <
            containerWidth - this.totalWidth
        ) {
            this.foldersToEllipsize--;
        }
    };

    render() {
        const { folderPath } = this;
        const { folder, onFolderClick } = this.props;

        const selectedCount: number = fileStore.selectedFilesOrFolders.length;

        return (
            <div className="breadcrumb-container">
                {selectedCount > 0 && !this.props.noSelectionCounter ? (
                    <div className="breadcrumb">
                        <Crumb
                            folder={fileStore.folderStore.root}
                            displayText={t('title_files')}
                            onClick={onFolderClick}
                            arrowAfter
                        />
                        {folder.isRoot && !folder.isShared ? null : (
                            <div className="breadcrumb-entry">
                                <span className="folder-name">...</span>
                                <MaterialIcon icon="keyboard_arrow_right" />
                            </div>
                        )}
                        <div className="breadcrumb-entry">
                            <span className="folder-name selected-count">
                                <T k="title_selected" tag="span" /> ({
                                    selectedCount
                                })
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="breadcrumb">
                        {folderPath.map((f, i) => (
                            <Crumb
                                key={`${f.id}-${f.name}`}
                                displayText={
                                    i > this.foldersToEllipsize
                                        ? f.name || t('title_files')
                                        : '...'
                                }
                                folder={f}
                                onClick={onFolderClick}
                                arrowAfter={i !== folderPath.length - 1}
                            />
                        ))}
                    </div>
                )}
                {(folder.isRoot && !folder.isShared) ||
                this.props.noActions ||
                selectedCount > 0 ? null : (
                    <FolderActions folder={folder} position="top-right" />
                )}
            </div>
        );
    }
}

interface CrumbProps {
    folder: any; // TODO/TS: icebear model
    onClick: (folder: any) => void; // TODO/TS: icebear model
    displayText: string;
    arrowAfter: boolean;
}

class Crumb extends React.Component<CrumbProps> {
    handleClick = () => {
        this.props.onClick(this.props.folder);
    };

    render() {
        const { displayText, arrowAfter } = this.props;

        return (
            <div className="breadcrumb-entry">
                <a className="folder-name clickable" onClick={this.handleClick}>
                    {displayText}
                </a>
                {arrowAfter && <MaterialIcon icon="keyboard_arrow_right" />}
            </div>
        );
    }
}
