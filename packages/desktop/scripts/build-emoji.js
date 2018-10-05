#!/usr/bin/env node

// @ts-check

const fs = require('fs');
const cp = require('child_process');

/** @type {any} */
const emojione = require('emojione');

const srcImages = './node_modules/emojione-assets/png/32/';
const srcSprites = './node_modules/emojione-assets/sprites/*-32-*@2x.png';
const srcCss = './node_modules/emojione-assets/sprites/emojione-sprite-32.css';
const srcJson = './node_modules/emojione/emoji.json';
const srcJs = './node_modules/emojione/lib/js/emojione.js';
const outDir = './src/static/emoji/';
const relativePngFolder = './static/emoji/png/';

// We need this so we can detect when new category has been added, it requires manual actions.
// Value should be an ascending index.
const knownCategories = {
    people: 1,
    nature: 1,
    food: 1,
    activity: 1,
    travel: 1,
    objects: 1,
    symbols: 1,
    flags: 1
};

const rawEmoji = JSON.parse(fs.readFileSync(srcJson, { encoding: 'utf8' }));

checkConsistencyWithLib(rawEmoji);

const asArray = convertToArrayAndCleanup(rawEmoji);
console.log(`Raw data source contains ${asArray.length} records`);

// byCanonicalShortname contains the fully-serialized emoji data; everything
// else exported by this file contains normalized references using the canonical
// shortname, and should be denormalized on load.
const { byCanonicalShortname, byAllShortnames, byAscii } = buildMaps(asArray);
const byCategory = groupByCategory(asArray);

cleanOutputDir();

const dataToWrite = {
    byCanonicalShortname,
    byAllShortnames,
    byAscii,
    byCategory
};

console.log('Writing JSON file.');
fs.writeFileSync(`${outDir}emoji.json`, JSON.stringify(dataToWrite));

console.log('Copying sprites.');
fs.mkdirSync(`${outDir}sprites`);
cp.execSync(`cp ${srcSprites} ${outDir}sprites`);
cp.execSync(`cp ${srcJs} ${outDir}emojione.js`);

console.log('Adjusting CSS.');
let css = fs.readFileSync(srcCss, 'utf8');
let repl;
// eslint-disable-next-line
while (true) {
    repl = css.replace(
        '@media only screen and (-webkit-min-device-pixel-ratio: 2),\nonly screen and (min-device-pixel-ratio: 2)',
        '@media all'
    );
    if (repl !== css) {
        css = repl;
        continue;
    }
    break;
}
console.log('Writing CSS to file.');
fs.writeFileSync(`${outDir}sprites/emojione.css`, css);

console.log('Copying images.');
cp.execSync(`cp -R ${srcImages} ${outDir}png`);

console.log('Done.');
process.exit(0);

// ---------------------------------------------------------------------------------------------------------------
function cleanOutputDir() {
    console.log('Cleaning output directory.');
    if (fs.existsSync(outDir)) cp.execSync(`rm -rf ${outDir}`);
    fs.mkdirSync(outDir);
    fs.writeFileSync(
        `${outDir}README.md`,
        '```\r\nThis directory is wiped and re-generated on build.\r\n' +
            'Do not add or modify files manually\r\n```'
    );
}

function getCSSCategoryName(emoji) {
    return emoji.diversity ? 'diversity' : emoji.origCategory || emoji.category;
}

function convertToArrayAndCleanup(emojiJson) {
    console.log('Converting raw emoji data to array.');
    const arr = [];
    const keys = Object.keys(emojiJson);
    for (let k = 0; k < keys.length; k++) {
        const item = emojiJson[keys[k]];
        if (item.category === 'regional') {
            item.category = 'flags';
            item.origCategory = 'regional';
        }
        if (item.category === 'modifier') continue;
        item.index = `${item.name} `;
        item.index += `${item.shortname} `;
        item.index += `${item.keywords.join(' ')} `;
        item.index += `${item.shortname_alternates.join(' ')} `;
        item.index += `${item.ascii.join(' ')} `;
        item.index = item.index.toLowerCase();

        // Used only for building in buildMaps function below, then deleted.
        item.tempAliases = item.shortname_alternates.slice(0, 2);
        item.tempAscii = item.ascii.slice(0, 2);

        // These are only used in the emoji picker component to show hints
        // (i _think_ that's why they're joined with double spaces here, too.)
        item.aliases = item.shortname_alternates.slice(0, 2).join('  ');
        item.ascii = item.ascii.slice(0, 2).join('  ');

        item.filename = `${relativePngFolder}${keys[k]}.png`;
        // item.code_points.fully_qualified can be null
        item.characters = (
            item.code_points.fully_qualified || item.code_points.base
        )
            .split('-')
            .map(code => String.fromCodePoint(Number.parseInt(code, 16)))
            .join('');

        item.className = `emojione emojione-32-${getCSSCategoryName(item)} _${
            keys[k]
        }`;

        delete item.shortname_alternates;
        delete item.keywords;
        delete item.display;
        delete item.code_points;
        delete item.gender;
        delete item.genders;
        delete item.unicode_version;

        delete item.diversity;
        delete item.diversities;
        delete item.origCategory;

        arr.push(item);
    }

    arr.sort((a, b) => (a.order > b.order ? 1 : a.order === b.order ? 0 : -1)); //eslint-disable-line
    arr.forEach(item => {
        delete item.order;
    });

    return arr;
}

function buildMaps(emojiArray) {
    console.log('Building shortname and ascii maps.');
    /* eslint-disable no-shadow */
    const byCanonicalShortname = {};
    const byAllShortnames = {};
    const byAscii = {};
    /* eslint-enable no-shadow */

    emojiArray.forEach(emoji => {
        if (emoji.shortname in byCanonicalShortname) {
            throw new Error(
                `Duplicate shortname detected: '${emoji.shortname}'`
            );
        }
        byCanonicalShortname[emoji.shortname] = emoji;
        byAllShortnames[emoji.shortname] = emoji.shortname;
        emoji.tempAliases.forEach(alias => {
            if (alias in byAllShortnames) {
                throw new Error(
                    `Duplicate shortname alias detected: '${alias}' => '${
                        byAllShortnames[alias]
                    }'`
                );
            }
            byAllShortnames[alias] = emoji.shortname;
        });
        emoji.tempAscii.forEach(ascii => {
            if (ascii in byAscii) {
                throw new Error(
                    `Duplicate ascii sequence detected: '${ascii}' => '${
                        byAscii[ascii]
                    }'`
                );
            }
            byAscii[ascii] = emoji.shortname;
        });

        delete emoji.tempAliases;
        delete emoji.tempAscii;
    });

    return { byCanonicalShortname, byAllShortnames, byAscii };
}

function groupByCategory(emojiArray) {
    console.log('Grouping emojis by category.');
    const grouped = {};
    Object.keys(knownCategories).forEach(category => {
        grouped[category] = [];
    });

    emojiArray.forEach(item => {
        if (typeof knownCategories[item.category] === 'undefined') {
            throw new Error(`Unknown category detected: ${item.category}`);
        }
        grouped[item.category].push(item.shortname);
    });

    return grouped;
}

// checks if emoji.json and precompiled emojione library have the same emojis
// well, technically we don't check if library has more then data, but it's very unlikely
// and it won't cause issues if it happens
function checkConsistencyWithLib(emojiJson) {
    const keys = Object.keys(emojiJson);
    for (let i = 0; i < keys.length; i++) {
        if (emojione.emojioneList[emojiJson[keys[i]].shortname]) continue;
        console.log(
            `WARNING: '${
                emojiJson[keys[i]].shortname
            }' is missing from emojione lib. Deleting from emoji data.`
        );
        delete emojiJson[keys[i]];
    }
}
