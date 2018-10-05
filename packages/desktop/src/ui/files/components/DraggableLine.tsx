import React from 'react';
import { observer } from 'mobx-react';
import { runInAction } from 'mobx';
import { DragSource, DragSourceSpec } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

import FileLine from './FileLine';
import DroppableFolderLine from './DroppableFolderLine';

import DragDropTypes from '../helpers/dragDropTypes';
import { getAllDraggedItems } from '../helpers/dragDropHelpers';
import { isFileOrFolderMoveable } from '../helpers/sharedFileAndFolderActions';

const fileOrFolderDragSpec: DragSourceSpec<DraggableLineProps, {}> = {
    beginDrag(props) {
        const initialSelectionState = props.fileOrFolder.selected;

        // the drag spec in theory shouldn't have side effects... but we already
        // need to rely on our singleton store/mutable global state to figure
        // out what we're dragging, so what's another log on the fire
        if (initialSelectionState === false) {
            runInAction(() => {
                props.fileOrFolder.selected = true;
            });
        }

        // in fact, that means we simply rely on our global selection state to
        // figure out where we can drop and what we're dropping, so the only
        // data we pass along here is whether the item was originally selected.
        return { initialSelectionState };
    },
    endDrag(props, monitor) {
        // we restore the selection state only if the drop wasn't handled.
        if (!monitor.didDrop()) {
            const { initialSelectionState } = monitor.getItem();
            if (initialSelectionState === false) {
                runInAction(() => {
                    props.fileOrFolder.selected = false;
                });
            }
        }
    },
    canDrag(props) {
        return isFileOrFolderMoveable(props.fileOrFolder);
    },
    isDragging(props) {
        return getAllDraggedItems().filesOrFolders.includes(props.fileOrFolder);
    }
};

// Due to limitations with react-dnd, we need a component that declares a shared
// DragSource spec to detect dragging multiple lines at the same time (otherwise
// isDragging would only get called for files OR folders, not a heterogeneous
// group of both.) We could probably alternately have hacked some stuff in to set
// additional shared state, but this ultimately seemed like a better solution.

interface DraggableLineProps {
    fileOrFolder: any; // TODO/TS: icebear model
    confirmShare: () => Promise<boolean>;
    connectDragPreview?: (image: HTMLImageElement) => void;
    connectDragSource?: (el: JSX.Element) => JSX.Element;
    isDragging?: boolean;
}

@DragSource(
    props =>
        props.fileOrFolder.isFolder ? DragDropTypes.FOLDER : DragDropTypes.FILE,
    fileOrFolderDragSpec,
    (connect, monitor) => ({
        connectDragPreview: connect.dragPreview(),
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging()
    })
)
@observer
export default class DraggableLine extends React.Component<DraggableLineProps> {
    componentDidMount() {
        // Disable the built-in HTML5 drag preview -- we render our own with a custom DragLayer.
        const { connectDragPreview } = this.props;
        connectDragPreview(getEmptyImage());
    }

    render() {
        const {
            fileOrFolder: f,
            isDragging,
            connectDragSource,
            confirmShare
        } = this.props;

        return connectDragSource(
            <div>
                {f.isFolder ? (
                    <DroppableFolderLine
                        folder={f}
                        folderActions
                        folderDetails
                        checkbox={!f.isShared}
                        isDragging={isDragging}
                        confirmShare={confirmShare}
                    />
                ) : (
                    <FileLine
                        file={f}
                        fileActions
                        fileDetails
                        checkbox
                        isDragging={isDragging}
                    />
                )}
            </div>
        );
    }
}
