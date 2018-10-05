// FIXME: cleanup @ts-ignores in here

interface EmojiJson {
    byCanonicalShortname: { [shortname: string]: Emoji };
    byAllShortnames: { [shortname: string]: string };
    byAscii: { [ascii: string]: string };
    byCategory: { [category: string]: string[] };
}

const emojiJson: EmojiJson = require('~/static/emoji/emoji.json');

export const pngFolder = './static/emoji/png/';

export interface Emoji {
    /** eg. "face with tears of joy" */
    name: string;
    category: string;
    /** eg. `:joy:` */
    shortname: string;
    /** concatenation of names/shortnames/aliases for filtering in the picker */
    index: string;
    /**
     * additional shortnames, as a string separated by double-spaces, for use in
     * the picker to show hints
     */
    aliases: string;
    /**
     * ascii sequence aliases for the emoji, as a string separated by
     * double-spaces, for use in the picker to show hints
     */
    ascii: string;
    /** the path to the png image for this emoji */
    filename: string;
    /** emoji string, as fully-qualified ready-to-use characters */
    characters: string;
    /** the CSS classname */
    className: string;
}

interface EmojiMap {
    people: Emoji[];
    nature: Emoji[];
    food: Emoji[];
    activity: Emoji[];
    travel: Emoji[];
    objects: Emoji[];
    symbols: Emoji[];
    flags: Emoji[];
}

/**
 * The original categories from the processed emoji data. Note that the dynamic
 * "recent" category in the emoji picker component is not included here.
 */
export const emojiCategories: { id: keyof EmojiMap; name: string }[] = [
    { id: 'people', name: 'Smileys & People' },
    { id: 'nature', name: 'Animals & Nature' },
    { id: 'food', name: 'Food & Drink' },
    { id: 'activity', name: 'Activity' },
    { id: 'travel', name: 'Travel & Places' },
    { id: 'objects', name: 'Objects' },
    { id: 'symbols', name: 'Symbols' },
    { id: 'flags', name: 'Flags' }
];

/**
 * Maps a _unique_ shortname to each emoji; no aliases (alternate shortnames) are included in this object.
 */
export const emojiByCanonicalShortname: { [shortname: string]: Emoji } =
    emojiJson.byCanonicalShortname;

// -----------------
// byCanonicalShortname has all the emoji data, but everything else in the JSON file has to be denormalized.
Object.values(emojiJson.byCategory).forEach(emojiList => {
    for (let i = 0; i < emojiList.length; i++) {
        // @ts-ignore (assigning a new type)
        emojiList[i] = emojiByCanonicalShortname[emojiList[i]];
    }
});

Object.keys(emojiJson.byAllShortnames).forEach(alias => {
    // @ts-ignore (assigning a new type)
    emojiJson.byAllShortnames[alias] =
        emojiByCanonicalShortname[emojiJson.byAllShortnames[alias]];
});

Object.keys(emojiJson.byAscii).forEach(ascii => {
    // @ts-ignore (assigning a new type)
    emojiJson.byAscii[ascii] =
        emojiByCanonicalShortname[emojiJson.byAscii[ascii]];
});
// -----------------

/**
 * Maps categories to arrays of emoji.
 */
// @ts-ignore (assigning the new type to the denormalized data)
export const emojiByCategories: EmojiMap = emojiJson.byCategory;

/**
 * Maps _all_ shortnames (including aliases) to emoji. Useful for completions and lookups.
 * @type {{ [shortname : string] : Emoji }}
 */
// @ts-ignore (assigning the new type to the denormalized data)
export const emojiByAllShortnames: { [shortname: string]: Emoji } =
    emojiJson.byAllShortnames;

/**
 * Maps _all_ shortnames (including aliases) to emoji. Useful for completions and lookups.
 * @type {{ [ascii : string] : Emoji }}
 */
// @ts-ignore (assigning the new type to the denormalized data)
export const emojiByAsciiSequences: { [ascii: string]: Emoji } =
    emojiJson.byAscii;
