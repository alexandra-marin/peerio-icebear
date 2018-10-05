const React = require('react');
const dragStore = require('~/stores/drag-drop-store');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { MaterialIcon } = require('peer-ui');
const { fileStore, chatStore } = require('peerio-icebear');
const { t } = require('peerio-translator');
const routerStore = require('~/stores/router-store');
const UploadDialog = require('../shared-components/UploadDialog');

@observer
class DropTarget extends React.Component {
    @observable dialogActive = false;
    @observable _files;

    componentWillMount() {
        dragStore.onFilesDropped(this.fileDropHandler);
    }

    fileDropHandler = (list, trees) => {
        if (this.dialogActive || list.success.length === 0) return;
        this._files = list.success;
        if (
            routerStore.currentRoute === routerStore.ROUTES.chats &&
            chatStore.activeChat
        ) {
            this.dialogActive = true;
            return;
        }
        let folder = null;
        if (routerStore.currentRoute === routerStore.ROUTES.files) {
            folder = fileStore.folderStore.currentFolder;
        }
        this.justUpload(trees, folder);
    };

    justUpload = async (trees, folder) => {
        await Promise.map(trees, tree => {
            if (typeof tree === 'string') {
                return fileStore.upload(tree, null, folder);
            }
            return fileStore.uploadFolder(tree, folder);
        });
        this.dialogActive = false;
    };

    dialogDeactivate() {
        this.dialogActive = false;
        this._files = [];
    }

    render() {
        if (routerStore.currentRoute === routerStore.ROUTES.files) return null;

        if (this.dialogActive || dragStore.preparingForUpload) {
            return (
                <UploadDialog
                    deactivate={() => this.dialogDeactivate()}
                    files={this._files}
                />
            );
        }

        if (!dragStore.hovering) return null;

        return (
            <div className="global-drop-target">
                <div className="drop-content">
                    <MaterialIcon icon="cloud_upload" />
                    <div className="display-2">
                        {t('title_dropToUpload', {
                            count: '' /* dragStore.hoveringFileCount */
                        })}
                        <div className="display-1">
                            {/* util.formatBytes(dragStore.hoveringFileSize) */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = DropTarget;
