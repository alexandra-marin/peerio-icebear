const React = require('react');
const { observable, when } = require('mobx');
const { observer } = require('mobx-react');
const { Dialog, MaterialIcon } = require('peer-ui');
const T = require('~/ui/shared-components/T');
const { serverSettings } = require('peerio-icebear');
const { t } = require('peerio-translator');
const moment = require('moment');

@observer
class MaintenanceWarning extends React.Component {
    @observable maintenanceStartDate = undefined;
    @observable maintenanceEndDate = undefined;
    @observable showDialog = false;

    constructor() {
        super();
        when(
            () =>
                serverSettings.maintenanceWindow &&
                serverSettings.maintenanceWindow.length === 2,
            () => {
                this.maintenanceStartDate = moment(
                    serverSettings.maintenanceWindow[0]
                ).format('LLL');
                this.maintenanceEndDate = moment(
                    serverSettings.maintenanceWindow[1]
                ).format('LLL');
            }
        );
    }

    toggleDialog = () => {
        this.showDialog = !this.showDialog;
    };

    dismiss = () => {
        this.toggleDialog();
    };

    render() {
        if (this.maintenanceStartDate && this.maintenanceEndDate) {
            return (
                <div>
                    <div
                        className="maintenance-wrapper"
                        onClick={this.toggleDialog}
                    >
                        <div className="maintenance-title">
                            {t('title_maintenance')}
                        </div>
                        <MaterialIcon
                            icon="info"
                            className="maintenance-icon"
                        />
                    </div>
                    <Dialog
                        active={this.showDialog}
                        theme="error"
                        title={t('dialog_scheduledMaintenance')}
                        onCancel={this.dismiss}
                        actions={[
                            {
                                label: t('button_dismiss'),
                                onClick: this.dismiss
                            }
                        ]}
                    >
                        <T k="dialog_scheduledMaintenanceDates" tag="p">
                            {{
                                start: this.maintenanceStartDate,
                                end: this.maintenanceEndDate
                            }}
                        </T>
                    </Dialog>
                </div>
            );
        }
        return null;
    }
}

module.exports = MaintenanceWarning;
