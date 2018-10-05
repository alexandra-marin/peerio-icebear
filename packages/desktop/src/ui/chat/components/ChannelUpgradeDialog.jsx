const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { Dialog } = require('peer-ui');
const { t } = require('peerio-translator');
const { User } = require('peerio-icebear');
const urls = require('~/config').translator.urlMap;
const config = require('~/config');

@observer
class ChannelUpgradeDialog extends React.Component {
    @observable showDialog = false;

    show = () => {
        this.showDialog = true;
    };

    hide = () => {
        this.showDialog = false;
    };

    toUpgrade = () => {
        window.open(urls.upgrade);
        this.hide();
    };

    render() {
        if (config.disablePayments) return null;
        const dialogActions = [
            { label: t('button_cancel'), onClick: this.hide },
            { label: t('button_upgrade'), onClick: this.toUpgrade }
        ];
        const limit = User.current ? User.current.channelLimit : 0;

        return (
            <Dialog
                active={this.showDialog}
                actions={dialogActions}
                onCancel={this.hide}
                title={t('title_limitDialog')}
                theme="warning"
            >
                <p>{t('title_limitDialogText1', { limit })}</p>
                <br />
                <p>{t('title_limitDialogText2')}</p>
            </Dialog>
        );
    }
}

module.exports = ChannelUpgradeDialog;
