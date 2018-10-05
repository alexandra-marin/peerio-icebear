// TODO: split schema into own file, possibly migrate to Icebear

import React from 'react';
import css from 'classnames';

import { Schema, Node } from 'prosemirror-model';

import { makeReactRenderer } from 'prosemirror-react-renderer';

import { emojiByCanonicalShortname, pngFolder } from '~/helpers/chat/emoji';
import { parseUrls } from '~/helpers/url';

/** Pattern to match against when creating a new mention node. */
const validUsernamePattern = /[a-zA-Z0-9_]{1,32}/;

// Schema originally adapted from https://github.com/ProseMirror/prosemirror-schema-basic.

// Versioning the schema: changing `parseDOM`, `toDOM` and `toReact` is okay;
// adding new nodes or marks should also be non-breaking. (Make sure their parse
// rules don't overlap existing rules!) Any other change should be considered
// breaking. (And note that "non-breaking" changes will not be
// backwards-compatible, regardless.)

// SECURITY: the toDOM() methods defined here are potential injection vectors if
// they define event handlers and interpolate values into them.
// (eg. { onclick: `openContact("${username}")` } )
// interpolating or using node values as text is fine, as it just creates text nodes
// (ie. https://developer.mozilla.org/en-US/docs/Web/API/Document/createTextNode) --
// just be careful with attributes!

export const chatSchema = new Schema(
    {
        nodes: {
            doc: { content: 'block+' },
            paragraph: {
                content: 'inline*',
                group: 'block',
                parseDOM: [{ tag: 'p' }],
                toDOM() {
                    return ['p', 0];
                }
            },
            text: { group: 'inline' },
            hard_break: {
                inline: true,
                group: 'inline',
                selectable: false,
                parseDOM: [{ tag: 'br' }],
                toDOM() {
                    return ['br'];
                }
            },
            // The link node has no `parseDOM` field: it can't be instantiated in
            // the input field, but might be created when sending the message.
            // (thus we also don't implement toDOM -- just toReact.)
            link: {
                inline: true,
                group: 'inline',
                content: 'text*',
                selectable: true,
                // SECURITY: it's less efficient than fully pre-parsing the url, but
                // for security, in chats links aren't allowed a different href than
                // their body (since this would enable eg. the ability for a
                // malicious client to trivially make phishing links -- the implicit
                // contract we establish in chats is that a link _always_ goes to
                // where it text says). so we use this link node to mark up
                // valid/permitted urls ahead of time, but still have to re-validate
                // them on the receiving side (which should still be quicker than
                // re-parsing the entire message.)
                //
                // if this is for some reason a perf bottleneck, we can revisit the
                // usage of `parseUrls` here in favour of a step that verifies and
                // normalizes but doesn't do a full parse, but this is the simplest
                // solution for now and ensures parity in behaviour with what
                // happens in the send step.
                toReact(node) {
                    const content = node.textContent;
                    const { href } = parseUrls(content)[0];
                    if (!href)
                        throw new Error(`Invalid parsed href for '${content}'`);
                    return <a href={href}>{content}</a>;
                }
            },
            mention: {
                inline: true,
                group: 'inline',
                selectable: true,
                marks: '',
                attrs: {
                    username: {}
                },
                parseDOM: [
                    {
                        tag: 'span',
                        getAttrs(e: HTMLSpanElement) {
                            const { username } = e.dataset;
                            if (
                                username &&
                                validUsernamePattern.test(username) &&
                                e.classList.contains('mention') &&
                                e.textContent === `@${username}`
                            )
                                return { username };

                            return false;
                        }
                    }
                ],
                toDOM(node) {
                    const { username } = node.attrs;
                    if (!validUsernamePattern.test(username)) {
                        throw new Error(`Invalid username: '${username}'`);
                    }

                    return [
                        'span',
                        {
                            class: 'mention',
                            'data-username': username
                        },
                        `@${username}`
                    ];
                },
                toReact(node, _, props) {
                    return (
                        <span
                            className={css('mention', 'clickable', {
                                self: node.attrs.username === props.currentUser
                            })}
                            data-username={node.attrs.username}
                            onClick={props.onClickContact}
                        >
                            @{node.attrs.username}
                        </span>
                    );
                }
            },
            emoji: {
                inline: true,
                group: 'inline',
                draggable: true,
                attrs: {
                    shortname: {}
                },
                parseDOM: [
                    {
                        tag: 'img',
                        getAttrs(e: HTMLImageElement) {
                            const shortname = e.title;
                            const src = e.getAttribute('src');
                            if (
                                e.className === 'emojione' &&
                                e.alt &&
                                shortname &&
                                shortname in emojiByCanonicalShortname &&
                                src &&
                                src.startsWith(pngFolder)
                            )
                                return { shortname };

                            return false;
                        }
                    }
                ],
                // HACK: we define both toDOM and toReact for emoji since React is
                // stricter about nodes like <img> not having children -- but
                // putting the emoji literal as a child of the img tag in the toDOM
                // implementation lets us trivially get the emoji plaintext using
                // the view element's .textContent.
                toDOM(node) {
                    const emoji =
                        emojiByCanonicalShortname[node.attrs.shortname];
                    if (!emoji) {
                        console.warn(
                            `emoji data not found for ${node.attrs.shortname}`
                        );
                        return [
                            'img',
                            {
                                class: 'emojione',
                                alt: '❔',
                                title: ':grey_question:',
                                src: `${pngFolder}/2754.png`
                            }
                        ];
                    }

                    return [
                        'img',
                        {
                            class: 'emojione',
                            alt: emoji.characters,
                            title: node.attrs.shortname,
                            src: emoji.filename
                        },
                        emoji.characters
                    ];
                },
                toReact(node) {
                    const emoji =
                        emojiByCanonicalShortname[node.attrs.shortname];
                    if (!emoji) {
                        console.warn(
                            `emoji data not found for ${node.attrs.shortname}`
                        );
                        return (
                            <img
                                className="emojione"
                                alt="❔"
                                title=":grey_question:"
                                src={`${pngFolder}2754.png`}
                            />
                        );
                    }

                    return (
                        <img
                            className="emojione"
                            alt={emoji.characters}
                            title={node.attrs.shortname}
                            src={emoji.filename}
                        />
                    );
                }
            }
        },
        marks: {
            em: {
                parseDOM: [
                    { tag: 'i' },
                    { tag: 'em' },
                    { style: 'font-style=italic' }
                ],
                toDOM() {
                    return ['em'];
                }
            },
            strike: {
                parseDOM: [
                    { tag: 's' },
                    { tag: 'strike' },
                    { tag: 'del' },
                    { style: 'text-decoration=line-through' }
                ],
                toDOM() {
                    return ['s'];
                }
            },
            strong: {
                parseDOM: [
                    { tag: 'strong' },
                    // This works around a Google Docs misbehavior where
                    // pasted content will be inexplicably wrapped in `<b>`
                    // tags with a font-weight normal.
                    // @ts-ignore (bad typings for 'node')
                    {
                        tag: 'b',
                        getAttrs: node =>
                            node.style.fontWeight !== 'normal' && null
                    },
                    // Incidentally, the `&& null` part in some of these parseDOM
                    // rules is confusing. getAttrs is used both to provide
                    // conditions for matching a parse rule AND to provide
                    // attributes (http://prosemirror.net/docs/ref/#model.Mark.attrs)
                    // for the created ProseMirror node or mark. If we return null,
                    // that means the rule matches but we're not providing any
                    // attributes (whereas 'false' means the rule didn't match.)

                    // @ts-ignore (bad typings for 'node')
                    {
                        style: 'font-weight',
                        getAttrs: value =>
                            /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
                    }
                ],
                toDOM() {
                    return ['strong'];
                }
            }
        }
    } as any /* bad typings */
);

export const emptyDoc = chatSchema.node(
    'doc',
    null,
    chatSchema.node('paragraph')
);

/**
 * Return whether the document is in its initial state.
 */
export function isEmpty(doc: Node): boolean {
    return doc.eq(emptyDoc);
}

/**
 * Return whether the given document/node contains only whitespace.
 */
export function isWhitespaceOnly(node: Node): boolean {
    if (node.isBlock) {
        if (
            node.type === chatSchema.nodes.paragraph ||
            node.type === chatSchema.nodes.doc
        ) {
            if (node.content.size > 0) {
                // if we're a paragraph node or a doc with content, we're whitespace if our contents are whitespace.
                // eslint-disable-next-line dot-notation, (inner content array not exposed in api)
                return node.content['content'].reduce(
                    (p, c) => p && isWhitespaceOnly(c),
                    true
                );
            }
            // if we're a paragraph node or a doc with no content, we're whitespace.
            return true;
        }
        // all other block nodes aren't whitespace.
        return false;
    }
    if (node.isText) {
        return node.text.trim().length === 0;
    }
    if (node.type === chatSchema.nodes.hard_break) {
        return true;
    }
    return false;
}

export const Renderer = makeReactRenderer<{
    onClickContact: React.MouseEventHandler;
    currentUser: string;
}>(chatSchema, 'MessageRichTextRenderer');
