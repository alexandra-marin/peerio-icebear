import React from 'react';
import { observer } from 'mobx-react';
import { computed } from 'mobx';
import { warnings, warningStates } from 'peerio-icebear';

@observer
export default class WarningDisplayBase<T = {}> extends React.Component<T> {
    readonly level: string;

    @computed
    get isVisible() {
        const w = warnings.current;
        return !!(
            w &&
            w.level === this.level &&
            w.state === warningStates.SHOWING
        );
    }

    constructor(level: string, props: T) {
        super(props);
        this.level = level;
    }

    dismiss = () => {
        warnings.current.dismiss();
    };
}
