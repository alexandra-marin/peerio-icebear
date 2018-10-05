import React from 'react';
import { action, computed, observable } from 'mobx';
import { observer } from 'mobx-react';
import { Dialog } from 'peer-ui';
import { t } from 'peerio-translator';
import Terms from './Terms';
import Privacy from './Privacy';

@observer
export default class LegalDialog extends React.Component<{
    content?: 'terms' | 'privacy';
}> {
    @observable show = false;
    @observable content = '';

    @computed
    get currentContent() {
        /*
            LegalDialog can be passed `content` directly as a prop
            Alternatively, can use `this.content`, allowing you to set content in parent (via ref) or child (via toggleContent)
        */
        return this.content || this.props.content;
    }

    @action.bound
    toggleContent(content: string): void {
        this.content = content;
    }

    @action.bound
    hideDialog() {
        this.show = false;
    }

    @action.bound
    showDialog() {
        this.show = true;
    }

    render() {
        const dialogActions = [
            { label: t('button_ok'), onClick: this.hideDialog }
        ];
        return (
            <Dialog
                active={this.show}
                actions={dialogActions}
                onCancel={this.hideDialog}
                className="terms-container"
            >
                {this.currentContent === 'terms' ? (
                    <Terms onToggleContent={this.toggleContent} />
                ) : null}
                {this.currentContent === 'privacy' ? (
                    <Privacy onToggleContent={this.toggleContent} />
                ) : null}
            </Dialog>
        );
    }
}
