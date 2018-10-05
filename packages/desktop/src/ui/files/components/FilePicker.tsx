import React from 'react';
import { observer } from 'mobx-react';
import { observable, computed } from 'mobx';

import { fileStore, chatStore } from 'peerio-icebear';
import { t } from 'peerio-translator';
import { Dialog, ProgressBar } from 'peer-ui';

import Search from '~/ui/shared-components/Search';

import FileLine from './FileLine';
import FolderLine from './FolderLine';
import Breadcrumb from './Breadcrumb';
import { setCurrentFolder } from '../helpers/sharedFileAndFolderActions';
import _ from 'lodash';

const DEFAULT_RENDERED_ITEMS_COUNT = 15;

interface FilePickerProps {
    active: boolean;
    hideLegacy?: boolean;
    onShare(selectedFilesOrFolders: any[]): void; // TODO/TS
    onClose(): void;
}

@observer
export default class FilePicker extends React.Component<FilePickerProps> {
    @observable renderedItemsCount = DEFAULT_RENDERED_ITEMS_COUNT;
    pageSize = DEFAULT_RENDERED_ITEMS_COUNT;

    container: HTMLElement | null = null;

    componentWillMount() {
        fileStore.folderStore.currentFolder = fileStore.folderStore.root;
    }

    componentWillUnmount() {
        fileStore.folderStore.currentFolder = fileStore.folderStore.root;
        fileStore.searchQuery = '';
    }

    checkScrollPosition = () => {
        if (!this.container) return;
        if (this.renderedItemsCount >= this.items.length) {
            this.renderedItemsCount = this.items.length;
            return;
        }

        const distanceToBottom =
            this.container.scrollHeight -
            this.container.scrollTop -
            this.container.clientHeight;
        if (distanceToBottom < 250) {
            this.renderedItemsCount += this.pageSize;
        }
    };

    readonly enqueueCheck = _.debounce(
        () => {
            window.requestAnimationFrame(this.checkScrollPosition);
        },
        100,
        { leading: true, maxWait: 400 }
    );

    readonly setScrollerRef = (ref: HTMLElement | null) => {
        if (!ref) {
            this.container = null;
            return;
        }
        this.container = ref;
        this.enqueueCheck(); // check the initial situation
    };

    readonly handleClose = () => {
        fileStore.clearSelection();
        fileStore.searchQuery = '';
        this.props.onClose();
        this.renderedItemsCount = DEFAULT_RENDERED_ITEMS_COUNT;
    };

    readonly handleShare = () => {
        const selected = fileStore.selectedFilesOrFolders;
        if (!selected.length) return;
        this.props.onShare(selected);
        fileStore.clearSelection();
        fileStore.searchQuery = '';
    };

    readonly handleSearch = (val: string) => {
        fileStore.searchQuery = val;
    };

    get breadCrumbsHeader() {
        return (
            <Breadcrumb
                noActions
                folder={fileStore.folderStore.currentFolder}
                onFolderClick={setCurrentFolder}
            />
        );
    }

    get searchResultsHeader() {
        return (
            <div className="search-results-header">
                {t('title_searchResults')}
            </div>
        );
    }

    @computed
    get items() {
        return fileStore.searchQuery
            ? fileStore.filesAndFoldersSearchResult
            : fileStore.folderStore.currentFolder.filesAndFoldersDefaultSorting;
    }

    render() {
        this.enqueueCheck();
        const actions = [
            { label: t('button_cancel'), onClick: this.handleClose },
            {
                label: t('button_share'),
                onClick: this.handleShare,
                primary: true,
                disabled: !fileStore.hasSelectedFilesOrFolders
            }
        ];

        const items = [];
        const data = this.items;
        const canShareFolder =
            chatStore.activeChat && !chatStore.activeChat.isChannel;
        for (let i = 0; i < this.renderedItemsCount && i < data.length; i++) {
            const f = data[i];
            if (f.isLegacy && this.props.hideLegacy) continue;

            // TODO: re-enable checkbox when folder sharing is allowed
            items.push(
                f.isFolder ? (
                    <FolderLine
                        key={f.id}
                        folder={f}
                        checkbox={false}
                        disabledCheckbox={
                            (!f.isShared && f.root.isShared) || !canShareFolder
                        }
                        folderDetailsMini
                    />
                ) : (
                    <FileLine
                        key={f.fileId}
                        file={f}
                        checkbox
                        clickToSelect
                        fileDetailsMini
                    />
                )
            );
        }

        return (
            <Dialog
                title={t('title_shareFromFiles')}
                className="file-picker"
                actions={actions}
                active={this.props.active}
                onCancel={this.handleClose}
            >
                {!fileStore.loading && this.props.active ? (
                    <div className="file-picker-body">
                        <Search
                            onChange={this.handleSearch}
                            query={fileStore.searchQuery}
                        />
                        {fileStore.searchQuery
                            ? this.searchResultsHeader
                            : this.breadCrumbsHeader}
                        <div className="file-table-wrapper">
                            <div
                                className="file-table-body"
                                ref={this.setScrollerRef}
                            >
                                {items}
                            </div>
                        </div>
                    </div>
                ) : null}
                {fileStore.loading && this.renderLoader()}
            </Dialog>
        );
    }

    renderLoader() {
        return (
            <div className="text-center">
                <ProgressBar type="linear" mode="indeterminate" />
            </div>
        );
    }
}
