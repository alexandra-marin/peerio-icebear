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

/**
 * Truncate string and add ellipsis if the end if it was truncated.
 *
 * If the string contains surrogate pairs (such as emoji), it doesn't
 * exactly keep the length to be maxChars (i.e. it can be less), but
 * truncates properly without leaving half of surrogate pair at the end.
 *
 * Can be improved...
 */
export function truncateWithEllipsis(s: string, maxChars: number): string {
    /* eslint-disable no-param-reassign */
    if (typeof s === 'undefined') return undefined;
    if (s.length <= maxChars) return s;
    s = s.substring(0, maxChars - 1); // minus ellipsis that we'll add
    // Already ends with ellipsis?
    if (s.endsWith('…')) return s;
    // Trim up to three periods at the end before adding ellipsis.
    if (s.endsWith('..')) s = s.substring(0, s.length - 2);
    if (s.endsWith('.')) s = s.substring(0, s.length - 1);
    // Trim a possible part of surrogate pair at the end.
    if (s.charCodeAt(s.length - 1) >= 2048) s = s.substring(0, s.length - 1);
    return `${s}…`;
}
