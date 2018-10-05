import React from 'react';
import { chatStore, contactStore } from 'peerio-icebear';
import { Avatar } from 'peer-ui';
import { EditorView } from 'prosemirror-view';

import { chatSchema } from '~/helpers/chat/prosemirror/chat-schema';
import Suggestions from './Suggestions';

// FIXME: use icebear Contact type
import { ContactProps } from 'peer-ui/dist/components/helpers/interfaces';
export type Contact_TEMP = ContactProps & { fullName: string }; // eslint-disable-line camelcase

export default function makeUsernameSuggestions(getView: () => EditorView) {
    return new Suggestions<Contact_TEMP>({
        // Match (but don't include) the start of the input, or any kind of
        // whitespace, or the unicode object replacement character (which we use
        // in the Suggestions to replace leaf nodes that don't contain text),
        // then an @ optionally followed by characters in a valid username
        matchers: [/(?<=^|\s|\u{fffc})@([a-zA-Z_]{0,32})$/u],
        source(matchData) {
            const chat = chatStore.activeChat;
            if (!chat || !chat.otherParticipants.length) return null;
            return contactStore.filter(
                matchData.match[1].toLocaleLowerCase(),
                chat.otherParticipants
            );
        },
        formatter: contact => (
            <span>
                <Avatar size="tiny" contact={contact} />
                <span className="semibold">@{contact.username}</span> -{' '}
                {contact.fullName}
            </span>
        ),
        keySource: 'username',
        onAcceptSuggestion: (matchData, acceptedSuggestion) => {
            const view = getView();
            if (view) {
                view.dispatch(
                    view.state.tr.replaceWith(matchData.from, matchData.to, [
                        chatSchema.node('mention', {
                            username: acceptedSuggestion.username
                        }),
                        chatSchema.text(' ')
                    ])
                );
            }
        }
    });
}
