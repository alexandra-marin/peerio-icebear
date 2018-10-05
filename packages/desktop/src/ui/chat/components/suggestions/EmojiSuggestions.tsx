import React from 'react';
import { EditorView } from 'prosemirror-view';

import { emojiByAllShortnames, Emoji } from '~/helpers/chat/emoji';
import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';
import Suggestions from './Suggestions';

const shortnames = Object.keys(emojiByAllShortnames);

export default function makeEmojiSuggestions(getView: () => EditorView) {
    return new Suggestions<{ emoji: Emoji; name: string }>({
        // Match (but don't include) the start of the input, or any kind of
        // whitespace, or the unicode object replacement character (which we use
        // in the Suggestions to replace leaf nodes that don't contain text),
        // then the start of an emoji shortname (a colon and two or more
        // characters.)
        matchers: [/(?<=^|\s|\u{fffc})(:[a-zA-Z0-9_+]{2,})$/u],
        source(matchData) {
            // TODO: use emoji index or split shortname by "_" instead of startsWith; maybe selecta-style matching?
            return shortnames
                .filter(name =>
                    name.startsWith(matchData.match[1].toLowerCase())
                )
                .map(name => ({ emoji: emojiByAllShortnames[name], name }));
        },
        formatter: data => (
            <span>
                <img
                    className="emojione"
                    alt={data.emoji.characters}
                    src={data.emoji.filename}
                    style={{ marginRight: 8 }}
                />
                {data.name}
            </span>
        ),
        keySource: 'name',
        onAcceptSuggestion: (matchData, acceptedSuggestion) => {
            const view = getView();
            if (view) {
                view.dispatch(
                    view.state.tr.replaceWith(
                        matchData.from,
                        matchData.to,
                        chatSchema.node('emoji', {
                            shortname: acceptedSuggestion.emoji.shortname
                        })
                    )
                );
            }
        }
    });
}
