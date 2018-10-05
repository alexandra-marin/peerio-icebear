import React from 'react';
import { observer } from 'mobx-react';
import { warnings } from 'peerio-icebear';
import css from 'classnames';

import T from '~/ui/shared-components/T';
import WarningDisplayBase from './WarningDisplayBase';

interface SnackbarProps {
    className?: string;
}

@observer
export default class Snackbar extends WarningDisplayBase<SnackbarProps> {
    constructor(props: SnackbarProps) {
        super('medium', props);
    }

    render() {
        const w = warnings.current;
        return (
            <div
                className={css(this.props.className, 'snackbar-wrapper', {
                    show: this.isVisible
                })}
                onClick={this.dismiss}
            >
                <div className="snackbar">
                    {w ? <T k={w.content}>{w.data}</T> : null}
                </div>
            </div>
        );
    }
}
