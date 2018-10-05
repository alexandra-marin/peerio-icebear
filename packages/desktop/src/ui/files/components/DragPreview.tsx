import React from 'react';
import { observer } from 'mobx-react';
import css from 'classnames';
import { t } from 'peerio-translator';
import { MaterialIcon } from 'peer-ui';
import FileSpriteIcon from '~/ui/shared-components/FileSpriteIcon';

// TODO/TS: icebear types

interface DragPreviewProps {
    files: any[];
    folders: any[];
    canDrop: boolean;
}

@observer
export default class DragPreview extends React.Component<DragPreviewProps> {
    render() {
        const { canDrop, files, folders } = this.props;

        const filesAndFoldersCount = files.length + folders.length;

        let displayName: string;
        let iconComponent: JSX.Element;
        if (filesAndFoldersCount === 1) {
            if (files.length > 0) {
                displayName = files[0].name;
                iconComponent = (
                    <FileSpriteIcon type={files[0].iconType} size="medium" />
                );
            } else {
                displayName = folders[0].name;
                iconComponent = <MaterialIcon icon="folder" />;
            }
        } else {
            displayName = t('title_draggingMultipleItems', {
                count: filesAndFoldersCount
            });
            iconComponent = <FileSpriteIcon type="other" size="medium" />;
        }

        return (
            <div className={css('files-dragpreview', { 'can-drop': canDrop })}>
                <div className="body">
                    <div className="file-icon">{iconComponent}</div>
                    <div className="file-description">{displayName}</div>
                </div>
            </div>
        );
    }
}
