/*
 * See documentation for the Suggestions plugin for discussion of this component
 * structure.
 */

import os from 'os';
import React from 'react';
import { observable, action, runInAction } from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';

import { EditorView } from 'prosemirror-view';
import { MarkType } from 'prosemirror-model';
import { Plugin, Transaction, EditorState } from 'prosemirror-state';
import { toggleMark } from 'prosemirror-commands';

import { chatSchema, isEmpty } from '~/helpers/chat/prosemirror/chat-schema';

interface FormattingConfig {
    markType: MarkType;
    label: string;
    onClick: (state: EditorState, dispatch: (tr: Transaction) => void) => void;
}

class FormattingButton {
    markType: MarkType;
    label: string;
    onClick: (state: EditorState, dispatch: (tr: Transaction) => void) => void;

    @observable active = false;

    view: EditorView;

    constructor(config: FormattingConfig) {
        const { markType, onClick, label } = config;
        this.markType = markType;
        this.onClick = onClick;
        this.label = label;
    }

    @action.bound
    plugin() {
        const self = this;

        this.active = false;
        return new Plugin({
            view() {
                return {
                    update(view) {
                        if (self.view !== view) self.view = view; // terrible hack, but desperate times...
                        runInAction(() => {
                            self.active = isMarkActive(
                                view.state,
                                self.markType
                            );
                        });
                    }
                };
            }
        });
    }

    handleClick = () => {
        // Ignore clicks when buttons aren't visible (which is controlled by the
        // parent component, via state derived from the same isEmpty condition
        // below.) Unfortunately this hybrid plugin-component design makes it
        // way harder to share component state derived from ProseMirror state,
        // so this sort of stuff will be necessarily fragile and bug-prone...)
        if (this.view && !isEmpty(this.view.state.doc)) {
            this.onClick(this.view.state, this.view.dispatch);
            this.view.focus();
        }
    };

    Component = observer(() => {
        const { active, label, markType } = this;

        return (
            <div
                onClick={this.handleClick}
                className={css(
                    'formatting-button',
                    `formatting-button-${markType.name}`,
                    { 'formatting-button-active': active }
                )}
            >
                {label}
            </div>
        );
    });
}

/**
 * Is the given mark active in the given editor state's selection set?
 */
function isMarkActive(state: EditorState, markType: MarkType): boolean {
    const { from, $from, to, empty } = state.selection;
    if (empty)
        return markType.isInSet(state.storedMarks || $from.marks()) != null;
    return state.doc.rangeHasMark(from, to, markType);
}

const prefix = os.type() === 'Darwin' ? 'cmd' : 'ctrl';

const BoldButton = new FormattingButton({
    markType: chatSchema.marks.strong,
    label: `${prefix}-b`,
    onClick: toggleMark(chatSchema.marks.strong)
});

const ItalicButton = new FormattingButton({
    markType: chatSchema.marks.em,
    label: `${prefix}-i`,
    onClick: toggleMark(chatSchema.marks.em)
});

const StrikeButton = new FormattingButton({
    markType: chatSchema.marks.strike,
    label: `${prefix}-5`,
    onClick: toggleMark(chatSchema.marks.strike)
});

export { BoldButton, ItalicButton, StrikeButton };
