const React = require('react');
const { computed, observable, reaction } = require('mobx');
const { observer } = require('mobx-react');
const { User, fileStore } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const { Dialog, ProgressBar } = require('peer-ui');
const EmojiImage = require('~/ui/emoji/Image');
const electron = require('electron').remote;
const fs = require('fs');

const migrationInProgressMessages = [];
const MIGRATION_MESSAGES_COUNT = 10;
const MESSAGE_SPEED = 10000;

for (let i = 1; i <= MIGRATION_MESSAGES_COUNT; i++) {
    const random = Math.floor(
        Math.random() * migrationInProgressMessages.length
    );

    if (i === 2) {
        // TODO: re-enable 2nd message once shared folders are added
        // migrationInProgressMessages.splice(random, 0, (
        //     <span>
        //         <T k={`title_migrationInProgressMessage${i}`} />&nbsp;
        //         <EmojiImage emoji="smile_cat" />
        //     </span>
        // ));
    } else if (i === 4) {
        migrationInProgressMessages.splice(
            random,
            0,
            <span>
                <T k={`title_migrationInProgressMessage${i}a`} />&nbsp;
                <EmojiImage emoji="muscle" />.&nbsp;
                <T k={`title_migrationInProgressMessage${i}b`} />
            </span>
        );
    } else {
        migrationInProgressMessages.splice(
            random,
            0,
            <T k={`title_migrationInProgressMessage${i}`} />
        );
    }
}

@observer
class MigrationDialog extends React.Component {
    componentWillMount() {
        this.dispose = reaction(
            () =>
                !fileStore.migration.started &&
                !fileStore.migration.performedByAnotherClient,
            () => this.clearTimer()
        );
    }

    componentWillUnmount() {
        this.clearTimer();
        if (this.dispose) this.dispose();
    }

    downloadFile = () => {
        const win = electron.getCurrentWindow();
        electron.dialog.showSaveDialog(
            win,
            {
                defaultPath: `${
                    User.current.username
                }-Peerio-shared-files-list.txt`
            },
            this.saveFile
        );
    };

    async saveFile(filePath) {
        if (!filePath) return;
        fs.writeFileSync(
            filePath,
            await fileStore.migration.getLegacySharedFilesText()
        );
    }

    @observable count = -1;
    @computed
    get currentMessage() {
        return migrationInProgressMessages[this.count];
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    renderProgress() {
        if (!this.timer) {
            this.timer = setInterval(() => {
                if (this.count < migrationInProgressMessages.length - 1) {
                    this.count += 1;
                } else {
                    this.count = 0;
                }
            }, MESSAGE_SPEED);
        }

        if (fileStore.migration.performedByAnotherClient) {
            return (
                <div className="update-in-progress">
                    <ProgressBar mode="indeterminate" />
                    <T
                        k="title_fileUpdateProgressDescription"
                        tag="p"
                        className="text"
                    />
                </div>
            );
        }

        return (
            <div className="update-in-progress">
                <ProgressBar
                    mode="determinate"
                    value={
                        fileStore.migration.progress
                            ? fileStore.migration.progress
                            : 1
                    }
                    max={100}
                />
                <div className="percent">
                    {fileStore.migration.progress
                        ? fileStore.migration.progress
                        : 1}%
                </div>
                {this.count >= 0 ? (
                    <div className="text">
                        <T k="title_migrationInProgressStaticMessage" tag="p" />
                        <p>{this.currentMessage}</p>
                    </div>
                ) : (
                    <T
                        k="title_fileUpdateProgressDescription"
                        tag="div"
                        className="text"
                    />
                )}
            </div>
        );
    }

    render() {
        // don't show migration progress if user has no shared files
        if (
            fileStore.migration.started &&
            !fileStore.migration.hasLegacySharedFiles
        ) {
            return null;
        }

        const migrationDialogActions = [
            {
                label: fileStore.migration.hasLegacySharedFiles
                    ? t('button_update')
                    : t('button_ok'),
                onClick: fileStore.migration.confirmMigration
            }
        ];

        const textParser = {
            download: text => (
                <a className="clickable" onClick={this.downloadFile}>
                    {text}
                </a>
            )
        };

        return (
            <Dialog
                active={fileStore.migration.pending}
                className="migration-dialog"
                actions={
                    fileStore.migration.started ||
                    fileStore.migration.performedByAnotherClient
                        ? null
                        : migrationDialogActions
                }
                title={
                    fileStore.migration.started ||
                    fileStore.migration.performedByAnotherClient
                        ? t('title_fileUpdateProgress')
                        : t('title_upgradeFileSystem')
                }
                theme="primary"
            >
                {fileStore.migration.started ||
                fileStore.migration.performedByAnotherClient ? (
                    this.renderProgress()
                ) : (
                    <div>
                        <T k="title_upgradeFileSystemDescription1" tag="p" />
                        <T k="title_upgradeFileSystemDescription2" tag="p" />
                        {fileStore.migration.hasLegacySharedFiles ? (
                            <T k="title_upgradeFileSystemDescription3" tag="p">
                                {textParser}
                            </T>
                        ) : null}
                    </div>
                )}
            </Dialog>
        );
    }
}

module.exports = MigrationDialog;
