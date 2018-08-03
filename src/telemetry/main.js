// Main telemetry functionality is here, most importantly init() and send()
const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');

const baseObj = {
    properties: {
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
    baseObj.properties.token = config.telemetry.token;
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

    // `properties` will be overwritten if you directly assign eventObj to baseObj or vice versa.
    // This song-and-dance merges the properties first, assigns the object, then assigns the object's properties
    properties = Object.assign(properties, baseObj.properties);
    const object = Object.assign({}, eventObj, baseObj);
    object.properties = properties;

    const data = global.btoa(JSON.stringify(object));
    const url = `${config.telemetry.baseUrl}${data}`;

    // TODO: this makes it easier to see tracking events for testing purposes. Remove before release.
    console.log(object);

    window.fetch(url, {
        method: 'POST'
    });
}

module.exports = {
    init,
    send
};
