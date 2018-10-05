import React from 'react';
import { observer } from 'mobx-react';
import { DragLayer } from 'react-dnd';
import DragPreview from './DragPreview';
import DragDropTypes from '../helpers/dragDropTypes';
import { getAllDraggedItems } from '../helpers/dragDropHelpers';

function getItemStyles(props: {
    currentOffset?: { x: number; y: number };
}): React.CSSProperties {
    const { currentOffset } = props;
    if (!currentOffset) {
        return {
            display: 'none'
        };
    }

    const { x, y } = currentOffset;
    const transform = `translate(${x}px, ${y}px)`;
    return {
        transform
    };
}

interface DragPreviewLayerProps {
    itemType?: string | Symbol;
    isDragging?: boolean;
    currentOffset?: { x: number; y: number };
    canDrop?: boolean;
}

@DragLayer(monitor => {
    const isDragging = monitor.isDragging();

    // There's currently no simple way to detect whether we're over a valid drop
    // target in the preview layer without iterating over potential targets. See
    // https://github.com/react-dnd/react-dnd/issues/448

    let canDrop = false;
    if (isDragging) {
        canDrop = (monitor as any) // fixme: bad typings
            .getTargetIds()
            .some(
                target =>
                    (monitor as any).isOverTarget(target) &&
                    (monitor as any).canDropOnTarget(target)
            );
    }

    return {
        itemType: monitor.getItemType(),
        currentOffset: monitor.getClientOffset(),
        isDragging,
        canDrop
    };
})
@observer
export default class DragPreviewLayer extends React.Component<
    DragPreviewLayerProps
> {
    render() {
        const { isDragging, canDrop, itemType } = this.props;

        if (!isDragging) {
            return null;
        }

        if (itemType === DragDropTypes.NATIVEFILE) {
            return null;
        }

        const { files, folders } = getAllDraggedItems();

        return (
            <div className="files-dragpreviewlayer">
                <div style={getItemStyles(this.props)}>
                    <DragPreview
                        files={files}
                        folders={folders}
                        canDrop={canDrop}
                    />
                </div>
            </div>
        );
    }
}
