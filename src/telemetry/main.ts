// Main telemetry functionality is here, most importantly init() and send()
const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');
const g = require('../helpers/global-context');

interface propertyTypes {
    'Version Number'?: number;
    distinct_id?: string;
    token?: string;
    Device?: 'Mobile' | 'Desktop';
    'App Version'?: string;
}

const baseObj: { properties: propertyTypes } = {
    properties: {
        'Version Number': 1 // refers to our own tracker library versioning
    }
};

async function getUserId(): Promise<string> {
    const userId: Promise<string> = await TinyDb.system.getValue('telemetryUserId');

    if (!userId) {
        const newId: any = cryptoUtil.getRandomGlobalShortIdHex().toString();
        await TinyDb.system.setValue('telemetryUserId', newId);
        return newId;
    }
    return userId;
}

export async function init() {
    const uuid: string = await getUserId();

    baseObj.properties.distinct_id = uuid; // eslint-disable-line
    baseObj.properties.token = config.telemetry.token;
    baseObj.properties.Device = config.isMobile ? 'Mobile' : 'Desktop';
    baseObj.properties['App Version'] = config.appVersion;
}

function camelToTitleCase(text: string): string {
    return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
}

export function send(eventObj) {
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

    const data = g.btoa(JSON.stringify(object));
    const url = `${config.telemetry.baseUrl}${data}`;

    // TODO: this makes it easier to see tracking events for testing purposes. Remove before release.
    console.log(object);

    window.fetch(url, {
        method: 'POST'
    });
}
