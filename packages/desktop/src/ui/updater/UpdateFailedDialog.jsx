const React = require('react');
const { Component } = require('react');
const { observer } = require('mobx-react');
const { shell, remote } = require('electron');
const { t } = require('peerio-translator');
const T = require('~/ui/shared-components/T');
const { Dialog } = require('peer-ui');
const updaterStore = require('~/stores/updater-store');
const config = require('~/config');

@observer
class UpdateFailedDialog extends Component {
    handleTryAgain() {
        updaterStore.quitAndRetryInstall();
    }

    handleDownloadManually() {
        shell.openExternal(config.translator.urlMap.download);
        updaterStore.cleanup().then(() => {
            remote.app.quit();
        });
    }

    handleContinue() {
        updaterStore.cleanup();
        updaterStore.lastUpdateFailed = false;
    }

    render() {
        if (!updaterStore.lastUpdateFailed) return null;

        return (
            <Dialog
                className="dialog-update-failed"
                theme="error"
                active={
                    updaterStore.lastUpdateFailed && !updaterStore.installing
                }
                title={t('title_updateFailed')}
                actions={[
                    {
                        label: t('button_continueUsingOlderVersion'),
                        onClick: this.handleContinue
                    },
                    {
                        label: t('button_downloadManually'),
                        onClick: this.handleDownloadManually
                    },
                    {
                        label: t('button_tryAgain'),
                        onClick: this.handleTryAgain
                    }
                ]}
            >
                <T k="title_updateFailedMessage" />
            </Dialog>
        );
    }
}

module.exports = UpdateFailedDialog;
