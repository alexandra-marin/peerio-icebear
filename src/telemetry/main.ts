import config from '../config';
import TinyDb from '../db/tiny-db';
import * as cryptoUtil from '../crypto/util';
import g from '../helpers/global-context';
import serverSettings from '../models/server-settings';

async function getUserId(): Promise<string> {
    const userId: string = await TinyDb.system.getValue('telemetryUserId');

    if (!userId) {
        const newId: string = cryptoUtil.getRandomGlobalShortIdHex();
        await TinyDb.system.setValue('telemetryUserId', newId);
        return newId;
    }
    return userId;
}

function camelToTitleCase(text: string): string {
    return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
}

interface BaseProperties {
    // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
    distinct_id: string;
    token: string;
    Device: '' | 'Mobile' | 'Desktop';
    'Version Number': number;
    'App Version': string;
}

interface EventProperties {
    [key: string]: string | number | boolean;
}

interface EventObject {
    event: string;
    properties: EventProperties;
}

export async function send(eventObj: EventObject): Promise<void> {
    try {
        const baseProperties: BaseProperties = {
            // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
            distinct_id: await getUserId(),
            Device: config.isMobile ? 'Mobile' : 'Desktop',
            'Version Number': 1, // refers to our own tracker library versioning,
            'App Version': config.appVersion,
            token: serverSettings.mixPanelClientToken // TODO: await here so events can't send before token available
        };

        // Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
        // So we still write props in camelCase when sending events from client, and convert them here.
        const eventProperties: EventProperties = {};
        Object.keys(eventObj.properties).forEach(itemInCamel => {
            const item = camelToTitleCase(itemInCamel);
            eventProperties[item] = eventObj.properties[itemInCamel];
        });

        eventObj.properties = { ...baseProperties, ...eventProperties };

        const data = g.btoa(JSON.stringify(eventObj));
        const url = `${config.telemetry.baseUrl}${data}`;

        console.log(eventObj);
        g.fetch(url, {
            method: 'GET'
        });
    } catch (e) {
        console.error('Could not send telemetry event.', e);
    }
}
