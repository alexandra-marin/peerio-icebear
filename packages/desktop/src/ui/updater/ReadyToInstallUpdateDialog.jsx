const React = require('react');
const { Component } = require('react');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const T = require('~/ui/shared-components/T');
const { Dialog } = require('peer-ui');
const updaterStore = require('~/stores/updater-store');

@observer
class ReadyToInstallUpdateDialog extends Component {
    handleUpdate() {
        updaterStore.quitAndInstall();
    }
    handleLater() {
        updaterStore.askToInstall = false;
    }
    render() {
        const actions = [
            { label: t('button_installUpdate'), onClick: this.handleUpdate }
        ];
        if (!updaterStore.mandatory) {
            actions.unshift({
                label: t('button_installUpdateLater'),
                onClick: this.handleLater
            });
        }
        return (
            <Dialog
                className="dialog-ready-to-install"
                active={
                    updaterStore.readyToInstall &&
                    updaterStore.askToInstall &&
                    !updaterStore.installing
                }
                actions={actions}
            >
                <T k="title_updateWillRestart" />
            </Dialog>
        );
    }
}

module.exports = ReadyToInstallUpdateDialog;
