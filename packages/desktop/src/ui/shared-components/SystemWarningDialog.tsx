import React from 'react';
import { Dialog } from 'peer-ui';
import { observer } from 'mobx-react';
import { t } from 'peerio-translator';
import { warnings } from 'peerio-icebear';

import T from '~/ui/shared-components/T';

import WarningDisplayBase from './WarningDisplayBase';

@observer
export default class SystemWarningDialog extends WarningDisplayBase {
    constructor(props) {
        super('severe', props);
    }

    render() {
        const w = warnings.current;

        return (
            <Dialog
                theme="warning"
                active={this.isVisible}
                title={w ? t(w.title) : ''}
                actions={[{ label: t('button_ok'), onClick: this.dismiss }]}
            >
                {w ? <T k={w.content}>{w.data}</T> : null}
            </Dialog>
        );
    }
}
