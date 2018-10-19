import { observable, autorun } from 'mobx';
import fetch from 'cross-fetch';

import { asPromise } from '../helpers/prombservable';
import config from '../config';
import TinyDb from '../db/tiny-db';
import { getRandomGlobalShortIdHex, strToBytes, bytesToB64 } from '../crypto/util';
import serverSettings from '../models/server-settings';
import { EventObject, EventProperties } from './types';
import User from '../models/user/user';

// Mixpanel accepts batch events but up to a maximum of 50 "messages". This term is not explained.
// We are guessing here. Currently assuming that "message" corresponds to an entire "event".
// Increment can be adjusted as we learn more.
const MIXPANEL_BATCH_SIZE = 50;

let userId: string;
const userIdState = observable({
    locked: false
});

async function getUserId(): Promise<string> {
    if (userId) return userId;
    await asPromise(userIdState, 'locked', false);

    if (!userId) {
        userIdState.locked = true;
        try {
            userId = await TinyDb.system.getValue('telemetryUserId');
            if (!userId) {
                userId = getRandomGlobalShortIdHex();
                await TinyDb.system.setValue('telemetryUserId', userId);
            }
        } catch (e) {
            console.error(e);
            throw e;
        }
        userIdState.locked = false;
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

async function getBaseProperties(): Promise<BaseProperties> {
    return {
        // eslint-disable-next-line camelcase, Mixpanel requires distinct_id in this format
        distinct_id: await getUserId(),
        Device: config.isMobile ? 'Mobile' : 'Desktop',
        'Version Number': 1, // refers to our own tracker library versioning,
        'App Version': config.appVersion,
        token: serverSettings.mixPanelClientToken // TODO: await here so events can't send before token available
    };
}

// Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
// So we still write props in camelCase when sending events from client, and convert them here.
function convertEventPropertyCase(event: EventObject): EventProperties {
    const eventProperties: EventProperties = {};

    Object.keys(event.properties).forEach(itemInCamel => {
        const item = camelToTitleCase(itemInCamel);
        eventProperties[item] = event.properties[itemInCamel];
    });

    return eventProperties;
}

let eventStore: EventObject[] = [];

export async function send(eventObj: EventObject): Promise<void> {
    const eventWithTime = eventObj;
    eventWithTime.properties.time = Date.now();

    if (!User.current || !User.current.settings.loaded) {
        console.log(eventWithTime);
        eventStore.push(eventWithTime);
        return;
    }
    if (!User.current.settings.dataCollection) return;

    try {
        const baseProperties = await getBaseProperties();
        const eventProperties = convertEventPropertyCase(eventWithTime);
        eventWithTime.properties = { ...baseProperties, ...eventProperties };

        const data = bytesToB64(strToBytes(JSON.stringify(eventWithTime)));
        const url = `${config.telemetry.baseUrl}?data=${data}`;

        await fetch(url, {
            method: 'GET'
        });
    } catch (e) {
        console.error('Could not send telemetry event.', e);
    }
}

async function sendStored(): Promise<void> {
    try {
        const baseProperties = await getBaseProperties();

        eventStore.forEach(ev => {
            const eventProperties = convertEventPropertyCase(ev);
            ev.properties = { ...baseProperties, ...eventProperties };
        });

        for (let i = 0; i < eventStore.length; i += MIXPANEL_BATCH_SIZE) {
            const chunk = eventStore.slice(i, i + MIXPANEL_BATCH_SIZE);
            const data = bytesToB64(strToBytes(JSON.stringify(chunk)));

            await fetch(config.telemetry.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `data=${data}`
            });
        }
        eventStore = [];
    } catch (e) {
        console.error('Could not send bulk telemetry event.', e);
    }
}

autorun(() => {
    if (
        User.current &&
        User.current.settings.loaded &&
        User.current.settings.dataCollection &&
        eventStore.length > 0
    ) {
        sendStored();
    }
});
