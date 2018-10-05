import { parseUrls } from '~/helpers/url';
import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';

import { EditorState } from 'prosemirror-state';

export function linkify(state: EditorState): EditorState {
    // this is basically nonsense, but i can't for the life of me figure out a
    // way to make multiple replacements in a single transaction in prosemirror
    // -- when there's several matches being applied, it sometimes corrupts the
    // indices, even if we perform them last-to-first. so instead we apply the
    // state and re-recurse into the document for each and every replacement.
    // not ideal, but messages are short and not deep and we're only doing this
    // once on send, so it's ok if it's a bit more work.
    let linkifiedState = state;
    let didMatch: boolean;
    do {
        didMatch = false;
        const { tr } = linkifiedState;
        // eslint-disable-next-line no-loop-func, consistent-return
        linkifiedState.doc.descendants((node, pos) => {
            if (didMatch) return false; // stop descending once we've made a replacement
            if (node.type.name === 'link') return false;
            // a limitation of examining nodes on a per-textnode level is that
            // we can't linkify a partly-styled url, eg. where part of the url
            // is bolded. in practice this should never be an issue, and text
            // that's fully-styled works.
            if (node.isText) {
                const matches = parseUrls(node.text!);
                // because of our weird approach, instead of iterating through
                // the matches we just grab the first one each time.
                if (matches.length > 0) {
                    const $from = linkifiedState.doc.resolve(
                        pos + matches[0].index
                    );
                    tr.replaceWith(
                        $from.pos,
                        $from.pos + matches[0].text.length,
                        chatSchema.node(
                            'link',
                            null,
                            chatSchema.text(matches[0].text),
                            node.marks
                        )
                    );
                    didMatch = true;
                }
            }
        });
        if (didMatch) linkifiedState = linkifiedState.apply(tr);
    } while (didMatch);

    return linkifiedState;
}
