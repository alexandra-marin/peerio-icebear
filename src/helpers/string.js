/**
 * String helpers
 */

// jsdoc hack..
let a; //eslint-disable-line

/**
 * Returns first unicode character of a string.
 * @param {string} str
 * @returns {string}
 */
function getFirstLetter(str) {
    if (!str || !str.length) return '';
    return String.fromCodePoint(str.codePointAt(0));
}
/**
 * Returns upper cased first unicode character of a string.
 * @param {string} str
 * @returns {string}
 */
function getFirstLetterUpperCase(str) {
    return getFirstLetter(str).toLocaleUpperCase();
}

module.exports = { getFirstLetter, getFirstLetterUpperCase };
