// Main telemetry functionality is here, most importantly init() and send()
const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');

const baseUrl = 'https://api.mixpanel.com/track/?data=';
const baseObj = {
    properties: {
        token: '05ee93d5cdb68e0de0709b6c85200c44', // TODO: this is for "Test setup". remember to replace it. env var?
        'Version Number': 1 // refers to our own tracker library versioning
    }
};

function getUserId() {
    return TinyDb.system
        .getValue('telemetryUserId')
        .then(id => {
            if (!id) {
                const newId = cryptoUtil.getRandomGlobalShortIdHex().toString();
                TinyDb.system.setValue('telemetryUserId', newId);
                return newId;
            }
            return id;
        })
        .catch(err => {
            console.error(err);
        });
}

async function init() {
    const uuid = await getUserId();

    baseObj.properties.distinct_id = uuid;
    baseObj.properties.Device = config.isMobile ? 'Mobile' : 'Desktop';
    baseObj.properties['App Version'] = config.appVersion;
}

function camelToTitleCase(text) {
    return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
}

function send(eventObj) {
    // Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
    // So we still write props in camelCase when sending events from client, and convert them here.
    let properties = {};
    Object.keys(eventObj.properties).forEach(itemInCamel => {
        const item = camelToTitleCase(itemInCamel);
        properties[item] = eventObj.properties[itemInCamel];
    });

    // `baseObj`'s properties will be overwritten on assign.
    // This song-and-dance merges the properties first, assigns the object, then assigns the object's properties
    properties = Object.assign(properties, baseObj.properties);
    const object = Object.assign({}, eventObj, baseObj);
    object.properties = properties;

    const data = global.btoa(JSON.stringify(object));
    const url = `${baseUrl}${data}`;

    console.log(object);

    window.fetch(url, {
        method: 'POST'
    });
}

module.exports = {
    init,
    send
};
