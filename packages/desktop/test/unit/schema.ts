import {
    chatSchema,
    isWhitespaceOnly,
    emptyDoc
} from '../../src/helpers/chat/prosemirror/chat-schema';

// TODO: all the chat schema testing would really benefit from a jsverify-style generator

const hardBreakOnly = chatSchema.node(
    'doc',
    null,
    chatSchema.node('paragraph', null, chatSchema.node('hard_break'))
);

const paragraphWithText = chatSchema.node(
    'doc',
    null,
    chatSchema.node('paragraph', null, chatSchema.text('some sample text'))
);

const paragraphWithWhitespace = chatSchema.node(
    'doc',
    null,
    chatSchema.node('paragraph', null, chatSchema.text('     '))
);

const paragraphWithEmoji = chatSchema.node(
    'doc',
    null,
    chatSchema.node(
        'paragraph',
        null,
        chatSchema.node('emoji', { shortname: ':grimacing:' })
    )
);

describe('chat schema', () => {
    [
        { doc: emptyDoc, name: 'empty doc', shouldBeWhitespaceOnly: true },
        {
            doc: hardBreakOnly,
            name: 'hard break only',
            shouldBeWhitespaceOnly: true
        },
        {
            doc: paragraphWithText,
            name: 'paragraph with text',
            shouldBeWhitespaceOnly: false
        },
        {
            doc: paragraphWithWhitespace,
            name: 'paragraph with whitespace',
            shouldBeWhitespaceOnly: true
        },
        {
            doc: paragraphWithEmoji,
            name: 'paragraph with emoji',
            shouldBeWhitespaceOnly: false
        }
    ].forEach(testCase => {
        it(`should determine whether node is whitespace only: '${
            testCase.name
        }'`, () => {
            const actual = isWhitespaceOnly(testCase.doc);
            expect(actual).toEqual(testCase.shouldBeWhitespaceOnly);
        });
    });
});
