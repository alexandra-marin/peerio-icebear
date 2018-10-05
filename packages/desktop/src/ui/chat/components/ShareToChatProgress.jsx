/* eslint-disable react/no-danger */
const React = require('react');
const { observer } = require('mobx-react');

const { fileHelpers } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const { Button, MaterialIcon, ProgressBar } = require('peer-ui');
const FileSpriteIcon = require('~/ui/shared-components/FileSpriteIcon');

@observer
class ShareToChatProgress extends React.Component {
    // TODO: handle folder share cancel once available
    handleCancel(item) {
        if (confirm(t('title_confirmCancelUpload'))) {
            item.cancelUpload();
        }
    }

    render() {
        const uploads = this.props.uploadQueue || [];
        const folders = this.props.folderShareQueue || [];
        if (!uploads.length && !folders.length) return null;
        const item = uploads[0] || folders[0];
        const queued = uploads.length + folders.length - 1;
        const { progress, progressMax, progressPercentage } = item;
        const uploadProgressPercentage = progress
            ? Math.floor((progress / progressMax) * 100)
            : 0;
        const fileType = fileHelpers.getFileIconType(
            fileHelpers.getFileExtension(item.name)
        );

        return (
            <div className="share-to-chat-progress">
                <div className="info">
                    {item.isFolder ? (
                        <MaterialIcon icon="folder" />
                    ) : queued ? (
                        <MaterialIcon icon="cloud_upload" />
                    ) : (
                        <FileSpriteIcon type={fileType} size="small" />
                    )}
                    <div className="text">
                        {item.isFolder ? (
                            <div>
                                <T k="title_sharing" tag="span" />&nbsp;
                                <span>
                                    <i>{item.name}</i>
                                </span>
                                {/* <span className="items-left">({t('title_itemsLeft', { number: 4 })})</span> */}
                            </div>
                        ) : queued ? (
                            <T k="title_queuedFiles" tag="span">
                                {{ name: item.name, remaining: queued }}
                            </T>
                        ) : (
                            <T k="title_uploadingAndEncrypting" tag="span">
                                {{ name: item.name }}
                            </T>
                        )}
                    </div>
                    <div className="percent-progress">
                        <span>
                            {item.isFolder
                                ? `${progressPercentage}%`
                                : queued
                                    ? null
                                    : `${uploadProgressPercentage}%`}
                        </span>

                        {item.isFolder ? null : !progress || // TODO: mocks show ability to cancel folder share-in-progress as well
                        progress < progressMax ? (
                            <Button
                                icon="cancel"
                                onClick={() => this.handleCancel(item)}
                                className="right-icon"
                            />
                        ) : null}

                        {!queued && progress && progress >= progressMax ? (
                            <MaterialIcon
                                icon="check"
                                className="affirmative right-icon"
                            />
                        ) : null}
                    </div>
                </div>

                {queued ? (
                    <ProgressBar type="linear" mode="indeterminate" />
                ) : (
                    <ProgressBar
                        type="linear"
                        mode="determinate"
                        value={progress || 0}
                        max={progressMax}
                    />
                )}
            </div>
        );
    }
}

module.exports = ShareToChatProgress;
