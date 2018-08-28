import util from '../crypto/util';

/**
 * Passphrase dictionary module.
 * @param locale - locale code for dict
 * @param dictString - '\n' separated word list
 */
class PhraseDictionary {
    constructor(locale: string, dictString: string) {
        this.locale = locale;
        this._buildDict(dictString);
    }

    locale;
    dict;

    /**
     * Returns a random passphrase of chosen word length
     * @param length - passphrase word count
     */
    getPassphrase(length: number) {
        if (!this.dict) throw new Error('no dictionary available');
        let ret = '';
        for (let i = 0; i < length; i++) {
            ret += this.dict[util.getRandomNumber(0, this.dict.length)];
            ret += ' ';
        }
        return ret.trim();
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
     */
    static current: PhraseDictionary;

    /**
     * Simple management of dictionaries: this function sets the PhraseDictionary.current property so it's accessible
     * whenever you need without re-creating the dictionary every time.
     */
    static setDictionary(localeCode: string, rawData: string) {
        if (PhraseDictionary.current) PhraseDictionary.current.dispose();
        PhraseDictionary.current = new PhraseDictionary(localeCode, rawData);
    }
}

export default PhraseDictionary;
