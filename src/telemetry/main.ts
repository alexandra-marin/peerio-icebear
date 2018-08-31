// Main telemetry functionality is here, most importantly init() and send()
const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');
const g = require('../helpers/global-context');
const serverSettings = require('../models/server-settings');

interface Properties {
    // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
    distinct_id: string;
    token: string;
    Device: 'Mobile' | 'Desktop';
    'Version Number': number;
    'App Version': string;
}
let baseObj: { properties: Properties };

async function getUserId(): Promise<string> {
    const userId: Promise<string> = await TinyDb.system.getValue('telemetryUserId');

    if (!userId) {
        const newId: any = cryptoUtil.getRandomGlobalShortIdHex();
        await TinyDb.system.setValue('telemetryUserId', newId);
        return newId;
    }
    return userId;
}

export async function init() {
    try {
        // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
        baseObj.properties.distinct_id = await getUserId();
        baseObj.properties.Device = config.isMobile ? 'Mobile' : 'Desktop';
        baseObj.properties['Version Number'] = 1; // refers to our own tracker library versioning
        baseObj.properties['App Version'] = config.appVersion;
    } catch (e) {
        console.error('Could not initialize telemetry.', e);
    }
}

function camelToTitleCase(text: string): string {
    return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
}

export function send(eventObj) {
    try {
        // Check server for Mixpanel token on every send, in case token changes.
        baseObj.properties.token = serverSettings.mixPanelClientToken;

        // Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
        // So we still write props in camelCase when sending events from client, and convert them here.
        let properties = {};
        Object.keys(eventObj.properties).forEach(itemInCamel => {
            const item = camelToTitleCase(itemInCamel);
            properties[item] = eventObj.properties[itemInCamel];
        });

        // `properties` will be overwritten if you directly assign eventObj to baseObj or vice versa.
        // This song-and-dance merges the properties first, assigns the object, then assigns the object's properties
        properties = { ...baseObj.properties, ...properties };
        const object = { ...eventObj, ...baseObj };
        object.properties = properties;

        const data = g.btoa(JSON.stringify(object));
        const url = `${config.telemetry.baseUrl}${data}`;

        console.debug(object);
        g.fetch(url, {
            method: 'GET'
        });
    } catch (e) {
        console.error('Could not send telemetry event.', e);
    }
}
