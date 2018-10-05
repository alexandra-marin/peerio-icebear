/*
 * See documentation for the Suggestions plugin for discussion of this component
 * structure.
 */

import React from 'react';
import { observable, action, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';
import { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { isEmpty } from '~/helpers/chat/prosemirror/chat-schema';

export default class FormattingToolbar {
    @observable enabled = false;

    @action.bound
    plugin(doc: Node) {
        const self = this;
        self.enabled = !isEmpty(doc);
        return new Plugin({
            view() {
                return {
                    update({ state: newState }) {
                        runInAction(() => {
                            self.enabled = !isEmpty(newState.doc);
                        });
                    }
                };
            }
        });
    }

    Component = observer(props => {
        const { enabled } = this;

        return (
            <div
                className={css('formatting-toolbar', {
                    'formatting-toolbar-visible': enabled
                })}
            >
                {props.children}
            </div>
        );
    });
}
