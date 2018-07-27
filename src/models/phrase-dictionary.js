const util = require('../crypto/util');

/**
 * Passphrase dictionary module.
 * @param {string} locale - locale code for dict
 * @param {string} dictString - '\n' separated word list
 */
class PhraseDictionary {
    locale;
    dict;

    constructor(locale, dictString) {
        this.locale = locale;
        this._buildDict(dictString);
    }

    /**
     * Returns a random passphrase of chosen word length
     * @param {number} length - passphrase word count
     */
    getPassphrase(length) {
        if (!this.dict) throw new Error('no dictionary available');
        let ret = '';
        for (let i = 0; i < length; i++) {
            ret += this.dict[util.getRandomNumber(0, this.dict.length)];
            ret += ' ';
        }
        return ret.trim(' ');
    }

    /**
     * Free RAM by removing cached dictionary
     */
    dispose() {
        this.dict = null;
    }

    _buildDict(dictString) {
        // normalizing words
        this.dict = dictString.split('\n');
        for (let i = 0; i < this.dict.length; i++) {
            // removing leading/trailing spaces and ensuring lower case
            this.dict[i] = this.dict[i].trim();
            // removing empty strings
            if (this.dict[i] === '') {
                this.dict.splice(i, 1);
                i--;
            }
        }
    }
    /**
     * Last chosen dictionary.
     * @type {PhraseDictionary}
     */
    static current;

    /**
     * Simple management of dictionaries: this function sets the PhraseDictionary.current property so it's accessible
     * whenever you need without re-creating the dictionary every time.
     * @param {string} localeCode
     * @param {string} rawData
     */
    static setDictionary(localeCode, rawData) {
        if (PhraseDictionary.current) PhraseDictionary.current.dispose();
        PhraseDictionary.current = new PhraseDictionary(localeCode, rawData);
    }
}

module.exports = PhraseDictionary;
