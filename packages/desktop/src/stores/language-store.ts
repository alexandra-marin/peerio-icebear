import fs from 'fs';
import path from 'path';

import moment from 'moment';
import { observable, action } from 'mobx';

import { setLocale } from 'peerio-translator';
import {
    errors as icebearErrors,
    TinyDb as db,
    PhraseDictionary
} from 'peerio-icebear';

const electron = require('electron').remote || require('electron');
const normalizeError = icebearErrors.normalize;

class LanguageStore {
    @observable language = '';

    // this is just a reference object (for language names)
    readonly languages: Readonly<{ [code: string]: string }> = {
        en: 'English',
        cs: 'Čeština',
        'zh-CN': '汉语',
        de: 'Deutsch',
        es: 'Español',
        fr: 'Français',
        it: 'Italiano',
        ja: '日本語',
        hu: 'Magyar',
        'nb-NO': 'Norsk (Bokmål)',
        'pt-BR': 'Português (Brasileiro)',
        ru: 'Русский',
        tr: 'Türkçe'
    };
    // ui
    readonly translationLangs: ReadonlyArray<string> = [
        'en',
        'cs',
        'zh-CN',
        'de',
        'es',
        'fr',
        'it',
        'ja',
        'hu',
        'nb-NO',
        'pt-BR',
        'ru',
        'tr'
    ];
    // passphrases
    readonly dictionaryLangs: ReadonlyArray<string> = [
        'en',
        'cs',
        'zh-CN',
        'de',
        'es',
        'fr',
        'it',
        'ja',
        'hu',
        'nb-NO',
        'pt-BR',
        'ru',
        'tr'
    ];

    _translationLangsCache: { value: string; label: string }[] | null = null;
    _dictionaryLangsCache: { value: string; label: string }[] | null = null;

    get translationLangsDataSource() {
        if (!this._translationLangsCache) {
            this._translationLangsCache = this.translationLangs.map(code => {
                return { value: code, label: this.languages[code] };
            });
        }
        return this._translationLangsCache;
    }

    get dictionaryLangsDataSource() {
        if (!this._dictionaryLangsCache) {
            this._dictionaryLangsCache = this.dictionaryLangs.map(code => {
                return { value: code, label: this.languages[code] };
            });
        }
        return this._dictionaryLangsCache;
    }

    buildDictionary() {
        const txtPath = path.join(
            electron.app.getAppPath(),
            `/node_modules/peerio-copy/phrase/dict/${this.language}.txt`
        );
        const dict = fs.readFileSync(txtPath, 'utf8');
        PhraseDictionary.setDictionary(this.language, dict);
    }

    @action.bound
    changeLanguage(code: string) {
        try {
            const jsonPath = path.join(
                electron.app.getAppPath(),
                `/node_modules/peerio-icebear/src/copy/${code.replace(
                    '-',
                    '_'
                )}.json`
            );
            const translation = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            setLocale(code, translation);
            this.language = code;
            // save to local storage
            db.system.setValue('language', code);
            // load correct passphrase dictionary
            this.buildDictionary();
            // set locale for dates
            moment.locale(code);
            console.log(`Language changed to ${code}`);
        } catch (err) {
            console.error(
                `Failed switch language to: ${code} ${normalizeError(err)}`
            );
        }
    }

    @action
    loadSavedLanguage() {
        db.system
            .getValue('language')
            .then(lang => this.changeLanguage(lang || 'en'))
            .catch(err => {
                console.error(err);
                this.changeLanguage('en'); // still change to English
            });
    }
}

export default new LanguageStore();
