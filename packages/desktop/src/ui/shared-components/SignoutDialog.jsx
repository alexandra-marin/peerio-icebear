const React = require('react');
const { Checkbox, Dialog } = require('peer-ui');
const { action, observable } = require('mobx');
const { observer } = require('mobx-react');
const { t } = require('peerio-translator');
const { User } = require('peerio-icebear');
const uiStore = require('~/stores/ui-store');

@observer
class SignoutDialog extends React.Component {
    @observable untrustDevice = false;

    @action.bound
    onToggleUntrust() {
        this.untrustDevice = !this.untrustDevice;
        uiStore.prefs.last2FATrustDeviceSetting = this.untrustDevice;
    }

    render() {
        const actions = [
            { label: t('button_cancel'), onClick: this.props.onHide },
            {
                label: t('button_logout'),
                onClick: () => this.props.onSignout(this.untrustDevice)
            }
        ];

        return (
            <Dialog
                active={this.props.active}
                actions={actions}
                className="signout-dialog"
                onCancel={this.props.onHide}
                title={t('button_logout')}
                theme="warning"
            >
                {t('title_signOutConfirmKeys')}
                {User.current.trustedDevice ? (
                    <div>
                        <br />
                        <Checkbox
                            checked={this.untrustDevice}
                            label={t('title_stopTrustingThisDevice')}
                            onChange={this.onToggleUntrust}
                        />
                    </div>
                ) : null}
            </Dialog>
        );
    }
}

module.exports = SignoutDialog;
