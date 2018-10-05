/**
 * String helpers
 */

/**
 * Returns first unicode character of a string.
 */
export function getFirstLetter(str: string) {
    if (!str || !str.length) return '';
    return String.fromCodePoint(str.codePointAt(0));
}
/**
 * Returns upper cased first unicode character of a string.
 */
export function getFirstLetterUpperCase(str: string) {
    return getFirstLetter(str).toLocaleUpperCase();
}
