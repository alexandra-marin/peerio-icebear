import React from 'react';
import { observer } from 'mobx-react';
import { Menu, MenuItem, Divider } from 'peer-ui';
import { t } from 'peerio-translator';
import { getDataProps } from '~/helpers/dom';

interface SharedFolderActionsProps {
    /** is the entire action menu disabled? */
    disabled?: boolean;

    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

    onClick?: () => void;

    onShare?: () => any;
    shareDisabled?: boolean;

    onDownload?: () => any;
    downloadDisabled?: boolean;

    onDelete?: () => any;
    onUnshare?: () => any;
}

@observer
export default class SharedFolderActions extends React.Component<
    SharedFolderActionsProps
> {
    render() {
        return (
            <Menu
                className="item-actions"
                icon="more_vert"
                position={this.props.position || 'bottom-right'}
                onClick={this.props.onClick}
                disabled={this.props.disabled}
                {...getDataProps(this.props)}
            >
                {this.props.onShare ? (
                    <MenuItem
                        caption={t('button_share')}
                        icon="person_add"
                        onClick={this.props.onShare}
                        disabled={this.props.shareDisabled}
                    />
                ) : null}
                {this.props.onDownload && (
                    <MenuItem
                        caption={t('title_download')}
                        icon="file_download"
                        onClick={this.props.onDownload}
                        disabled={this.props.downloadDisabled}
                    />
                )}
                {(this.props.onShare || this.props.onDownload) &&
                (this.props.onUnshare || this.props.onDelete) ? (
                    <Divider />
                ) : null}
                {this.props.onUnshare && (
                    <MenuItem
                        caption={t('button_unshare')}
                        className="custom-icon-hover-container"
                        customIcon="remove-member"
                        onClick={this.props.onUnshare}
                    />
                )}
                {this.props.onDelete && (
                    <MenuItem
                        caption={t('button_delete')}
                        icon="delete"
                        onClick={this.props.onDelete}
                    />
                )}
            </Menu>
        );
    }
}
