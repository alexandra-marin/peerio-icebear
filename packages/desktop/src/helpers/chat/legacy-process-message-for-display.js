// @ts-check
const Autolinker = require('autolinker');
const htmlEncoder = require('html-entities').AllHtmlEntities;

const { User, contactStore } = require('peerio-icebear');

const { sanitizeChatMessage } = require('~/helpers/sanitizer');
const { isUrlAllowed } = require('~/helpers/url');

const emojione = require('~/static/emoji/emojione.js');

emojione.ascii = true;
emojione.imagePathPNG = './static/emoji/png/';
emojione.sprites = false;
emojione.greedyMatch = true;

let ownMentionRegex;
function highlightMentions(str) {
    // eslint-disable-next-line no-return-assign
    return str.replace(
        ownMentionRegex ||
            (ownMentionRegex = contactStore.getContact(User.current.username)
                .mentionRegex),
        '<span class="mention self">$&</span>'
    );
}

const mentionRegex = /(\s*|^)@([a-zA-Z0-9_]{1,32})/gm;
function linkifyMentions(str) {
    return str.replace(
        mentionRegex,
        '$1<span class="mention clickable" onClick=legacyOpenContact("$2")>@$2</span>'
    );
}

const inlinePreRegex = /`(.*)`/g;
const blockPreRegex = /`{3}([^`]*)`{3}/g;
function formatPre(str) {
    return str
        .replace(blockPreRegex, '<div class="pre">$1</div>')
        .replace(inlinePreRegex, '<span class="pre">$1</span>');
}

/** @type {any} */
const autolinker = new Autolinker({
    urls: {
        schemeMatches: true,
        wwwMatches: true,
        tldMatches: true
    },
    replaceFn(match) {
        if (match.getType() === 'url') {
            let url = match.getUrl();
            url = htmlEncoder.decode(url);
            if (!isUrlAllowed(url)) return false;
            // processUrl(url); TODO: consent
            return true;
        }

        return false;
    },
    email: true,
    phone: false,
    mention: false,
    hashtag: false,
    stripPrefix: false,
    newWindow: false,
    truncate: 0,
    className: '',
    stripTrailingSlash: false
});

/**
 * Given an Icebear message, sanitizes it and processes it for display in a React Message component.
 *
 * Also caches the result in the message's processedText field, returning it immediately if it's valid.
 * @param {{lastProcessedVersion, version, processedText : { __html : string }, text : string}} msg
 * @returns {{ __html : string }} The processed message, ready for direct use in `dangerouslySetInnerHTML`.
 */
// eslint-disable-next-line import/prefer-default-export
export function processMessageForDisplay(msg) {
    if (msg.lastProcessedVersion !== msg.version) msg.processedText = null;
    if (msg.processedText != null) return msg.processedText;

    // we don't expect any html in original text,
    // if there are any tags - user entered them, we consider them plaintext and encode

    // we don't expect any html in original text,
    // if there are any tags - user entered them, we consider them plaintext and encode
    /** @type {string} */
    let str = emojione.toShort(msg.text);
    str = htmlEncoder.encode(str);
    // in case some tags magically sneak in - remove all html except whitelisted
    str = sanitizeChatMessage(str);
    // now we start producing our own html
    str = autolinker.link(str);
    str = emojione.shortnameToImage(str);
    str = highlightMentions(str);
    str = linkifyMentions(str);
    str = formatPre(str);

    msg.processedText = { __html: str };
    msg.lastProcessedVersion = msg.version;

    return msg.processedText;
}
