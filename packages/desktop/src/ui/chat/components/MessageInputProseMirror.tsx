/*

For simplicity, this component's render method returns an array of components,
using React 16's capacity to return unwrapped fragments.
(see https://egghead.io/lessons/react-render-multiple-elements-without-a-wrapping-element-in-a-component-in-react-16)

The parent component, MessageInput, also has its own components to render in a
flex group, so this lets them all mount inline. This could be confusing, so we
might want to revisit this in a later refactor.

Note that all components we return in the array need a unique key (which only
needs to be unique to this particular component, not siblings in other files)
so we give the suggests wrapper, emoji picker button, emoji picker and input
field their own named keys manually.

*/

import React from 'react';
import { observable, observe, action, Lambda } from 'mobx';
import { observer } from 'mobx-react';

import { Node } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { EditorState, Selection, Plugin, Transaction } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';

import { t } from 'peerio-translator';
import { Button } from 'peer-ui';
import { chatStore } from 'peerio-icebear';

import {
    chatSchema,
    isWhitespaceOnly,
    emptyDoc
} from '~/helpers/chat/prosemirror/chat-schema';

import { Emoji } from '~/helpers/chat/emoji';
import { chatPlugins } from '~/helpers/chat/prosemirror/chat-plugins';
import { placeholder } from '~/helpers/chat/prosemirror/placeholder';
import { linkify } from '~/helpers/chat/prosemirror/linkify-text';
import { ensureMentions } from '~/helpers/chat/prosemirror/ensure-mentions';
import uiStore from '~/stores/ui-store';

import EmojiPicker from '~/ui/emoji/Picker';
import makeUsernameSuggestions, {
    Contact_TEMP as Contact
} from './suggestions/UsernameSuggestions';
import makeEmojiSuggestions from './suggestions/EmojiSuggestions';

import Suggestions from './suggestions/Suggestions';

import { BoldButton, ItalicButton, StrikeButton } from './FormattingButton';
import FormattingToolbar from './FormattingToolbar';

const Toolbar = new FormattingToolbar();

// ---------------------------------
// BEGIN KIND OF JANKY CACHING CODE:

// We cache the emoji picker the first time we need it, and never change it.
// This is not great for testability of the input component; it may be worth
// revisiting later.
let cachedPicker;

// Because we're caching the emoji picker as a global, we need to also keep
// track of its parent input component, which would normally pass down callbacks
// for picking the emoji and handling hiding the picker.
let currentInputInstance;

function onEmojiPicked(emoji) {
    currentInputInstance.hideEmojiPicker();

    const view: EditorView = currentInputInstance.editorView;
    if (!view) return;

    insertEmoji(emoji, view.state, view.dispatch);
    view.focus();
}

function insertEmoji(
    emoji: { shortname: string },
    state: EditorState,
    dispatch: (tr: Transaction) => void
) {
    const type = chatSchema.nodes.emoji;
    const { $from } = state.selection;
    if (!$from.parent.canReplaceWith($from.index(), $from.index(), type))
        return false;
    if (dispatch) {
        dispatch(
            state.tr.replaceSelectionWith(
                type.create({
                    shortname: emoji.shortname
                })
            )
        );
    }
    return true;
}
// ---------------------------------

@observer
export default class MessageInputProseMirror extends React.Component<{
    placeholder: string;
    onSend: (richText: Object, legacyText: string) => void;
}> {
    @observable emojiPickerVisible = false;

    /**
     * The ProseMirror editor view. Should only be assigned when we get a render
     * ref, and destroyed when the component will unmount.
     */
    private editorView: EditorView | null = null;

    /**
     * ProseMirror plugins that we won't need to reconfigure.
     */
    private readonly basePlugins: Plugin[];

    private readonly usernameSuggestions: Suggestions<Contact>;

    private readonly emojiSuggestions: Suggestions<{
        emoji: Emoji;
        name: string;
    }>;

    private disposer!: Lambda;

    getEmptyState() {
        return EditorState.create({
            doc: emptyDoc,
            plugins: this.getConfiguredPlugins(emptyDoc)
        });
    }

    /**
     * Get the full set of plugins for the ProseMirror editor, including those
     * which can be reconfigured or aren't necessarily known while the
     * constructor is running.
     */
    getConfiguredPlugins(doc: Node) {
        return [
            placeholder(this.props.placeholder, emptyDoc),
            Toolbar.plugin(doc),
            BoldButton.plugin(),
            ItalicButton.plugin(),
            StrikeButton.plugin(),
            ...this.basePlugins
        ];
    }

    constructor(props) {
        super(props);

        currentInputInstance = this;
        if (!cachedPicker) {
            cachedPicker = (
                <EmojiPicker
                    key="emoji-picker"
                    onPicked={onEmojiPicked}
                    onBlur={() => {
                        currentInputInstance.hideEmojiPicker();
                    }}
                />
            );
        }

        this.usernameSuggestions = makeUsernameSuggestions(
            () => this.editorView
        );
        this.emojiSuggestions = makeEmojiSuggestions(() => this.editorView);

        // Note the ordering: the suggestions plugin has to come before the
        // general Enter key handling, since we want the former to handle Enter
        // when suggestions are visible.
        this.basePlugins = [
            this.usernameSuggestions.plugin,
            this.emojiSuggestions.plugin,
            keymap({
                // we have to declare this command in the class body since we're
                // using `this.props.onSend` and `this.clearEditor`.
                Enter: (
                    state: EditorState,
                    dispatch: (tr: Transaction) => void,
                    view: EditorView
                ) => {
                    if (isWhitespaceOnly(state.doc)) return false;

                    if (dispatch) {
                        const linkifiedState = linkify(state);
                        const mentionifiedState = ensureMentions(
                            linkifiedState
                        );

                        // For the plaintext version of our message, we grab the
                        // view element's `textContent` -- ProseMirror nodes
                        // offer their own `textContent` getter, but they only
                        // concatenate the _text_ nodes underneath them, not
                        // anything else -- so stuff like emoji and mentions
                        // wouldn't get included.

                        // Incidentally, getting the DOM `textContent` correctly
                        // retrieves emoji even though they're rendered as <img>
                        // tags in the view, because we add the emoji text as a
                        // child of the <img>, ie.
                        // <img src="{emojione image}">{emoji unicode chars}</img>.
                        //
                        // This is (probably) valid DOM; the tag's contents
                        // aren't rendered, just the image proper. (That said,
                        // React forbids doing this.) We could alternately use
                        // <spans> with a background-image or pseudo-element,
                        // similar to eg. Slack.

                        // Since textContent strips <br> tags, and ProseMirror doesn't
                        // insert line breaks after them, to extract text with proper
                        // line breaks, we deep clone the editor's DOM node and append
                        // '\n' after each <br>.
                        const domClone = view.dom.cloneNode(true) as Element;
                        domClone.querySelectorAll('br').forEach(br => {
                            br.insertAdjacentText('afterend', '\n');
                        });

                        this.props.onSend(
                            mentionifiedState.doc.toJSON(),
                            domClone.textContent
                        );
                        this.clearEditor();
                    }

                    return true;
                }
            }),
            ...chatPlugins
        ];
    }

    componentDidMount() {
        this.disposer = observe(
            chatStore,
            'activeChat',
            change => {
                this.backupUnsentMessage(change.oldValue);
                this.restoreUnsentMessage(change.newValue);
            },
            true
        );
    }

    componentWillUnmount() {
        this.backupUnsentMessage(chatStore.activeChat);
        this.disposer();
        uiStore.messageInputEditorView = null;
        if (this.editorView) {
            this.editorView.destroy();
        }
        this.usernameSuggestions.cleanup();
        this.emojiSuggestions.cleanup();
    }

    componentDidUpdate(prevProps) {
        if (this.props.placeholder !== prevProps.placeholder) {
            this.editorView.updateState(
                this.editorView.state.reconfigure({
                    plugins: this.getConfiguredPlugins(
                        this.editorView.state.doc
                    )
                })
            );
        }
    }

    @action.bound
    showEmojiPicker() {
        this.usernameSuggestions.dismiss();
        this.emojiSuggestions.dismiss();
        this.emojiPickerVisible = true;
    }

    @action.bound
    hideEmojiPicker() {
        this.emojiPickerVisible = false;
    }

    clearEditor = () => {
        this.usernameSuggestions.dismiss();
        this.emojiSuggestions.dismiss();
        if (this.editorView) this.editorView.updateState(this.getEmptyState());
    };

    backupUnsentMessage(chat) {
        if (!chat || !this.editorView) return;
        uiStore.unsentMessages[chat.id] = this.editorView.state.doc.toJSON();
    }

    restoreUnsentMessage(chat) {
        // TODO: revisit the need for this try/catch? it's a holdover from Quill
        try {
            const view = this.editorView;
            if (!view) return;

            if (!chat) {
                this.clearEditor();
                return;
            }

            const savedState = uiStore.unsentMessages[chat.id];
            if (!savedState) {
                this.clearEditor();
                return;
            }

            view.state.doc = Node.fromJSON(chatSchema, savedState);
            view.setProps({
                state: view.state.apply(
                    view.state.tr.setSelection(Selection.atEnd(view.state.doc))
                )
            });
            view.focus();
        } catch (err) {
            console.error(`Can't restore unsent message:`, err);
            // don't care, swallowing errors because don't want to deal with all the mounted/unmounted/created states
        }
    }

    @action.bound
    mountProseMirror(el: HTMLDivElement) {
        if (!el) {
            uiStore.messageInputEditorView = null;
            return;
        }
        this.editorView = new EditorView(el, { state: this.getEmptyState() });
        uiStore.messageInputEditorView = this.editorView;
    }

    onInputBlur = () => {
        this.usernameSuggestions.dismiss();
        this.emojiSuggestions.dismiss();
    };

    render() {
        /*
         * In theory, we might want to enforce that only one suggestions
         * component is visible at a time; in practice, this shouldn't really
         * come up, assuming the conditions (regex patterns) to show them are
         * mutually exclusive. If need be, we could pick one to show -- maybe
         * with a computed that will find() the first suggestion instance for
         * which suggestion.visible is true.
         */
        const UsernameSuggestions = this.usernameSuggestions.Component;
        const EmojiSuggestions = this.emojiSuggestions.Component;

        return [
            <UsernameSuggestions key="username-suggestions" />,
            <EmojiSuggestions key="emoji-suggestions" />,
            <div
                key="editor"
                className="message-editor-container-anotherwrapper"
            >
                <div
                    id="messageEditor"
                    className="message-editor-container-prosemirror"
                    onBlur={this.onInputBlur}
                    ref={this.mountProseMirror}
                />
                <Toolbar.Component>
                    <BoldButton.Component />
                    <ItalicButton.Component />
                    <StrikeButton.Component />
                </Toolbar.Component>
            </div>,
            <Button
                key="emoji-picker-open-button"
                icon="mood"
                disabled={this.emojiPickerVisible}
                onClick={this.showEmojiPicker}
                tooltip={t('button_emojis')}
                tooltipSize="small"
                theme="no-hover"
            />,
            this.emojiPickerVisible ? cachedPicker : null
        ];
    }
}
