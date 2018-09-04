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
    Device: '' | 'Mobile' | 'Desktop';
    'Version Number': number;
    'App Version': string;
}
const baseProperties = {} as Properties;

async function getUserId(): Promise<string> {
    const userId: string = await TinyDb.system.getValue('telemetryUserId');

    if (!userId) {
        const newId: string = cryptoUtil.getRandomGlobalShortIdHex();
        await TinyDb.system.setValue('telemetryUserId', newId);
        return newId;
    }
    return userId;
}

export async function init(): Promise<void> {
    try {
        // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
        baseProperties.distinct_id = await getUserId();
        baseProperties.Device = config.isMobile ? 'Mobile' : 'Desktop';
        baseProperties['Version Number'] = 1; // refers to our own tracker library versioning
        baseProperties['App Version'] = config.appVersion;
    } catch (e) {
        console.error('Could not initialize telemetry.', e);
    }
}

function camelToTitleCase(text: string): string {
    return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
}

interface EventObject {
    event: string;
    properties: {};
}

export function send(eventObj: EventObject): void {
    try {
        // Check server for Mixpanel token on every send, in case token changes.
        baseProperties.token = serverSettings.mixPanelClientToken;

        // Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
        // So we still write props in camelCase when sending events from client, and convert them here.
        let properties = {};
        Object.keys(eventObj.properties).forEach(itemInCamel => {
            const item = camelToTitleCase(itemInCamel);
            properties[item] = eventObj.properties[itemInCamel];
        });

        const sendObject = eventObj;
        properties = { ...baseProperties, ...properties };
        sendObject.properties = properties;

        const data = g.btoa(JSON.stringify(sendObject));
        const url = `${config.telemetry.baseUrl}${data}`;

        console.log(sendObject);
        g.fetch(url, {
            method: 'GET'
        });
    } catch (e) {
        console.error('Could not send telemetry event.', e);
    }
}
