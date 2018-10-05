import { Plugin } from 'prosemirror-state';
import { DOMParser } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import cheerio from 'cheerio';
import debounce from 'lodash/debounce';

import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';
import { emojiByCanonicalShortname, Emoji } from '~/helpers/chat/emoji';

const unicodeToEmoji = {};
const unicodeSequences = [];
Object.values(emojiByCanonicalShortname).forEach(emoji => {
    unicodeToEmoji[emoji.characters] = emoji;
    unicodeSequences.push(emoji.characters);
});

const emojiRegex = new RegExp(
    `[${unicodeSequences
        .map(seq => seq.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&'))
        .join('')}]`,
    'gu'
);

const parser = DOMParser.fromSchema(chatSchema);

/**
 * This plugin replaces emoji in three separate cases:
 * - when input from an emoji keyboard or other IME that supports unicode (in
 *   the handleTextInput method below)
 * - when pasted from a plaintext source (via clipboardTextParser method)
 * - when pasted from an HTML source (via transformPastedHTML method).
 *
 * The latter two don't attempt to override ProseMirror's DOM parsing or create
 * their own PM nodes -- instead they just manipulate the HTML string that's
 * passed to the parser.
 */
export function emojiPlugin() {
    // ProseMirror's handleTextInput prop seems to always work with surrogate
    // halves, so an IME that inserts an emoji may call it twice or more with
    // meaningless characters each time.
    //
    // As a solution, we accumulate characters with a short debounce, and check
    // them all on the trailing edge.
    let charAccumulator: string;
    let _from: number;

    function resetCharacterCheck() {
        charAccumulator = '';
        _from = Number.MAX_VALUE;
    }
    resetCharacterCheck();

    // TODO: verify if we need a debounce time in any scenarios or if the
    // nextTick-like default behaviour is always sufficient.
    const checkCharacters = debounce((view: EditorView) => {
        const emoji = unicodeToEmoji[charAccumulator];
        if (emoji) {
            const { state } = view;
            view.dispatch(
                state.tr.replaceWith(
                    _from,
                    _from + charAccumulator.length,
                    state.schema.node('emoji', { shortname: emoji.shortname })
                )
            );
        }

        resetCharacterCheck();
    });

    // Note that this mirrors the values returned by toDOM and toReact in the
    // chat schema, and the DOM tag we build in clipboardTextParser below -- if
    // any of them change, the change should be reflected everywhere!
    const unicodeToImg = (unicode: string) => {
        const emoji = unicodeToEmoji[unicode];
        if (!emoji) return unicode;
        return `<img class="emojione" alt="${emoji.characters}" title="${
            emoji.shortname
        }" src="${emoji.filename}" />`;
    };

    // Our plugin intercepts both pasted HTML and pasted plaintext; it does an
    // additional pre-parse transformation for the former, and replaces
    // ProseMirror's initial parse step for the latter.
    // Instead of handling both those cases, we _could_ in theory use
    // http://prosemirror.net/docs/ref/#view.EditorProps.transformPasted and
    // just transform the already-parsed result (ie. the ProseMirror node about
    // to be inserted into the document), walking its tree and splitting text
    // nodes/inserting emoji nodes where needed. In practice this seems to be
    // both more complicated and less performant than having these separate methods.
    return new Plugin({
        props: {
            // Using Cheerio here is maybe not the most optimal solution, but it
            // works reliably and allows us to do a quick replacement on HTML
            // without worrying that we're eg. invalidating the HTML by replacing
            // inside an attribute value.
            transformPastedHTML(html: string) {
                const $ = cheerio.load(html);
                $('*')
                    .contents()
                    .filter((_i, el) => el.type === 'text')
                    .each((_i, el) => {
                        const wrapped = $(el);

                        const text: string = wrapped.text();
                        const replacement = text.replace(
                            emojiRegex,
                            unicodeToImg
                        );
                        if (replacement !== text) {
                            wrapped.replaceWith(replacement);
                        }
                    });
                return $.html();
            },
            // Handle pasted plain text that may contain emoji. Since
            // ProseMirror's view component is built on contentEditable, it
            // always transforms any pasted content to HTML before parsing it to
            // its internal model. ProseMirror's default behaviour with
            // plaintext is to trim leading and trailing whitespace, split on
            // newlines, and wrap each line in a <p> tag. We do the same, but
            // additionally we test each line for emoji, and if we match any, we
            // split the line and build text nodes and <img> tags within its <p>
            // tag.
            clipboardTextParser(text: string) {
                const dom = document.createElement('div');
                text.trim()
                    .split(/(?:\r\n?|\n)+/)
                    .forEach(block => {
                        let match: RegExpMatchArray | undefined;

                        const result: (Emoji | string)[] = [];

                        let lastIndex = 0;

                        // eslint-disable-next-line no-cond-assign
                        while ((match = emojiRegex.exec(block))) {
                            if (match.index > lastIndex) {
                                result.push(
                                    block.slice(lastIndex, match.index)
                                );
                            }

                            const emoji = unicodeToEmoji[match[0]];
                            // if we don't match the emoji for some reason, just push the characters.
                            result.push(emoji || match[0]);

                            lastIndex = emojiRegex.lastIndex; // eslint-disable-line prefer-destructuring
                        }

                        if (result.length > 0) {
                            if (lastIndex < block.length) {
                                result.push(block.slice(lastIndex));
                            }

                            const p = dom.appendChild(
                                document.createElement('p')
                            );
                            for (const fragment of result) {
                                if (typeof fragment === 'string') {
                                    p.appendChild(
                                        document.createTextNode(fragment)
                                    );
                                } else {
                                    // Note that this mirrors the values returned by
                                    // toDOM and toReact in the chat schema, and the
                                    // unicodeToImg function used in
                                    // transformPastedHTML above -- if any of them
                                    // change, the change should be reflected
                                    // everywhere!
                                    const img = p.appendChild(
                                        document.createElement('img')
                                    );
                                    img.className = 'emojione';
                                    img.alt = fragment.characters;
                                    img.title = fragment.shortname;
                                    img.src = fragment.filename;
                                }
                            }
                        } else {
                            // If we didn't find any emoji, no need for complex
                            // logic to build up the dom tag -- just set its
                            // textContent.
                            dom.appendChild(
                                document.createElement('p')
                            ).textContent = block;
                        }
                    });
                return parser.parseSlice(dom);
            },
            // Handle unicode input directly from keyboard.
            handleTextInput(view, from, _to, text) {
                charAccumulator += text;
                _from = Math.min(_from, from);
                checkCharacters(view);
                return false;
            }
        }
    });
}
