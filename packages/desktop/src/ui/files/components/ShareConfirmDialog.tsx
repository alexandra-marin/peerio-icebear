import React from 'react';
import { observable, action } from 'mobx';
import { observer } from 'mobx-react';
import T from '~/ui/shared-components/T';
import { t } from 'peerio-translator';
import { Checkbox, Dialog } from 'peer-ui';
import uiStore from '~/stores/ui-store';

@observer
export default class ShareConfirmDialog extends React.Component {
    @observable shareWarningDisabled = false;

    dialogRef = React.createRef<Dialog>();

    resolve: ((res: boolean) => void) | null = null;

    @action.bound
    async check() {
        if (uiStore.prefs.seenMoveToSharedVolumeWarning) return true;
        this.dialogRef.current.showWithoutAnimation();
        return new Promise<boolean>(resolve => {
            this.resolve = resolve;
        });
    }

    @action.bound
    async cancel() {
        this.dialogRef.current.hideWithoutAnimation();
        this.resolve(false);
    }

    @action.bound
    confirm() {
        this.dialogRef.current.setInactive();
        if (this.shareWarningDisabled) {
            uiStore.prefs.seenMoveToSharedVolumeWarning = true;
        }
        this.resolve(true);
    }

    @action.bound
    toggleShareWarning() {
        this.shareWarningDisabled = !this.shareWarningDisabled;
    }

    render() {
        const shareConfirmActions = [
            { label: t('button_cancel'), onClick: this.cancel },
            { label: t('button_move'), onClick: this.confirm }
        ];

        return (
            // @ts-ignore lucas needs to fix the props!
            <Dialog
                ref={this.dialogRef}
                actions={shareConfirmActions}
                onCancel={this.cancel}
                title={t('title_moveToSharedFolder')}
                className="move-file-confirm-share"
            >
                <T k="title_moveToSharedFolderDescription" />
                <div className="share-warning-toggle">
                    <Checkbox
                        checked={this.shareWarningDisabled}
                        onChange={this.toggleShareWarning}
                        label={t('title_dontShowMessageAgain')}
                    />
                </div>
            </Dialog>
        );
    }
}
