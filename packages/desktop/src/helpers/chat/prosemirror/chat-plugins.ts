import os from 'os';

import {
    exitCode,
    toggleMark,
    chainCommands,
    baseKeymap
} from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { undo, redo, history } from 'prosemirror-history';
import { undoInputRule, inputRules, InputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { EditorState, Transaction } from 'prosemirror-state';

import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';
import {
    emojiByAllShortnames,
    emojiByAsciiSequences
} from '~/helpers/chat/emoji';
import { emojiPlugin } from '~/helpers/chat/prosemirror/emoji-plugin';
import { ensuredInputRules } from '~/helpers/chat/prosemirror/ensured-input-rules';

// We want most of the keys from the base keymap but filter a few out
const { Enter, ...passthroughKeys } = baseKeymap;

/* eslint-disable dot-notation */
const chatKeys = {
    ...passthroughKeys,
    'Shift-Enter': chainCommands(
        exitCode,
        (state: EditorState, dispatch: (tr: Transaction) => void) => {
            if (dispatch) {
                dispatch(
                    state.tr
                        .replaceSelectionWith(
                            chatSchema.nodes.hard_break.create()
                        )
                        .scrollIntoView()
                );
            }
            return true;
        }
    ),
    // keybindings are referenced in the FormattingButton component, so if
    // they're being changed here make sure they're reflected there as well!
    'Mod-b': toggleMark(chatSchema.marks.strong),
    'Mod-i': toggleMark(chatSchema.marks.em),
    'Mod-5': toggleMark(chatSchema.marks.strike),
    Backspace: chainCommands(undoInputRule, baseKeymap['Backspace']),
    'Mod-Backspace': baseKeymap['Mod-Backspace'],
    Delete: baseKeymap['Delete'],
    'Mod-Delete': baseKeymap['Mod-Delete'],
    'Mod-a': baseKeymap['Mod-a'],
    'Mod-z': undo,
    'Shift-Mod-z': redo
};

chatKeys['Mod-Enter'] = chatKeys['Shift-Enter'];

if (os.type() !== 'Darwin') {
    chatKeys['Mod-y'] = chatKeys['Shift-Mod-z'];
} else {
    chatKeys['Ctrl-h'] = chatKeys['Backspace'];
    chatKeys['Alt-Backspace'] = chatKeys['Mod-Backspace'];
    chatKeys['Ctrl-d'] = chatKeys['Delete'];
    chatKeys['Ctrl-Alt-Backspace'] = chatKeys['Mod-Delete'];
    chatKeys['Alt-Delete'] = chatKeys['Mod-Delete'];
    chatKeys['Alt-d'] = chatKeys['Mod-Delete'];
    chatKeys['Ctrl-Enter'] = chatKeys['Shift-Enter'];
}
/* eslint-enable dot-notation */

const chatKeymap = keymap(chatKeys);

// Match (but don't include) the start of the input, or any kind of whitespace,
// or the unicode object replacement character (used by InputRule to replace
// leaf nodes that don't contain text), then @something followed by whitespace.
// TODO: we may also want to break on things other than whitespace but still apply the rule?
const mentionInputRulePattern = /(?<=^|\s|\u{fffc})@([a-zA-Z0-9_]{1,32})(\s)$/u;
const mentionInputRule = new InputRule(
    mentionInputRulePattern,
    (state, match, start, end) => {
        const s = state.schema;

        const replacement = [
            s.node('mention', { username: match[1].toLowerCase() }),
            s.text(match[2]) // use the same kind of trailing whitespace in the replacement.
        ];

        return state.tr.replaceWith(start, end, replacement);
    }
);

// Match (but don't include) the start of the input, or any kind of whitespace,
// or the unicode object replacement character (used by InputRule to replace
// leaf nodes that don't contain text), then a candidate emoji shortname (we
// check its validity in the rule.)
// TODO: is this an exhaustive list of valid characters in shortnames?
const emojiShortnameInputRulePattern = /(?<=^|\s|\u{fffc})(:[a-zA-Z0-9_+]{2,}:)$/u;
const emojiShortnameInputRule = new InputRule(
    emojiShortnameInputRulePattern,
    (state, match, start, end) => {
        const emoji = emojiByAllShortnames[match[1].toLowerCase()];
        if (!emoji) return null;
        return state.tr.replaceWith(
            start,
            end,
            state.schema.node('emoji', { shortname: emoji.shortname })
        );
    }
);

const asciiPattern = Object.keys(emojiByAsciiSequences) // take all the ascii sequences we can match...
    .map(seq => seq.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')) // ...and escape all their regex-meaningful characters...
    .join('|'); // ...then join them as a single regex-able match pattern.

// Match (but don't include) the start of the input, or any kind of whitespace,
// or the unicode object replacement character (used by InputRule to replace
// leaf nodes that don't contain text), then any of the ascii emoji sequences,
// followed by whitespace.
const emojiAsciiInputRulePattern = new RegExp(
    `(?<=^|\\s|\u{fffc})(${asciiPattern})(\\s)$`,
    'u'
);
const emojiAsciiInputRule = new InputRule(
    emojiAsciiInputRulePattern,
    (state, match, start, end) => {
        const emoji = emojiByAsciiSequences[match[1]];
        if (!emoji) return null;

        const s = state.schema;
        const replacement = [
            s.node('emoji', { shortname: emoji.shortname }),
            s.text(match[2]) // use the same kind of trailing whitespace in the replacement.
        ];

        return state.tr.replaceWith(start, end, replacement);
    }
);

export const chatPlugins = [
    chatKeymap,
    dropCursor(),
    gapCursor(),
    history(),
    inputRules({ rules: [emojiShortnameInputRule, emojiAsciiInputRule] }),
    ensuredInputRules({ rules: [mentionInputRule] }),
    emojiPlugin()
];
