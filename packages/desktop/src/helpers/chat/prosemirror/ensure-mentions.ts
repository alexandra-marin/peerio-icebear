import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';

import { EditorState } from 'prosemirror-state';

// Same as the input rule pattern, but we can lookahead for whitespace OR the end of the input
const mentionEnsurePattern = /(?<=^|\s|\u{fffc})@([a-zA-Z0-9_]{1,32})(?=\s|$)/u;

// See linkify-text.js for explanation of this approach.

export function ensureMentions(state: EditorState): EditorState {
    let mentionifiedState = state;
    let didMatch: boolean;
    do {
        didMatch = false;
        const { tr } = mentionifiedState;
        // eslint-disable-next-line no-loop-func, consistent-return
        mentionifiedState.doc.descendants((node, pos) => {
            if (didMatch) return false;
            if (node.isText) {
                const match = mentionEnsurePattern.exec(node.text);
                if (match) {
                    const $from = mentionifiedState.doc.resolve(
                        pos + match.index
                    );
                    tr.replaceWith(
                        $from.pos,
                        $from.pos + match[0].length,
                        chatSchema.node(
                            'mention',
                            { username: match[1].toLowerCase() },
                            null,
                            node.marks
                        )
                    );
                    didMatch = true;
                }
            }
        });
        if (didMatch) mentionifiedState = mentionifiedState.apply(tr);
    } while (didMatch);

    return mentionifiedState;
}
