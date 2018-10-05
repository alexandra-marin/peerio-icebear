/**
 * Helper functions for e2e tests.
 */

import fs from 'fs';
import electron from 'electron';
import { Application } from 'spectron';

export const isDev = process.env.NODE_ENV !== 'production';

export interface Context {
    app: Application;
}

/**
 * Starts the electron app and waits for it to load.
 */
export function startApp(context: Context): Promise<void> {
    context.app = isDev
        ? new Application({ path: electron as any, args: ['./app'] })
        : new Application({
              path: `./dist/mac/Peerio Messenger.app/Contents/MacOS/Peerio Messenger`
          });

    return context.app
        .start()
        .then(() => {
            expect(context.app.isRunning()).toBe(true);
            return context.app.client.windowByIndex(1);
        })
        .then(() => {
            return context.app.client.waitUntilWindowLoaded();
        });
}

/**
 * Loads electron and waits until it's connected to the server.
 */
export async function startAppAndConnect(context: Context): Promise<void> {
    await startApp(context);
    return context.app.client.waitUntil(
        () => {
            return context.app.client
                .execute(() => {
                    return ice.socket.connected; // eslint-disable-line no-undef
                })
                .then(c => {
                    return c.value;
                });
        },
        5000,
        'websocket connection timed out',
        500
    );
}

/**
 * Start the app, wait until socket is connected, and log in with passphrase regardless of
 * whether or not a returning user is set.
 */
export async function startAppAndLogin(context: Context): Promise<void> {
    await startAppAndConnect(context);
    return login(context);
}

/**
 * Log in with passphrase.
 *
 * Passcode will be force-wiped because passcodes take too damn long to be practical
 * when tests are running on the CI.
 *
 * Depending on state of test suite/machine, the returning user flag
 * may or may not be set, so we clear it if it was set.
 */
export async function login(context: Context): Promise<void> {
    const userDataPath = context.app.electron.remote.app.getPath('userData');

    // wipe the passcode
    const systemTinyDb = JSON.parse(
        fs.readFileSync(`${userDataPath}/system_tinydb.json`).toString()
    );
    delete systemTinyDb[`${testUser.username}:passcode`];
    fs.writeFileSync(
        `${userDataPath}/system_tinydb.json`,
        JSON.stringify(systemTinyDb)
    );
    const returning = await context.app.client.isVisible('.welcome-back');

    if (returning) {
        await context.app.client.click('.welcome-back');
    }
    await context.app.client
        .setValue('div.login-form > div:nth-child(2) input', testUser.username)
        .setValue('div.login-form > div.password input', testUser.passphrase)
        .waitForEnabled('div.login > button')
        .click('div.login > button');

    await context.app.client.waitForVisible('.test-new-device', 30000);
}

/**
 * Close the app.
 */
export async function closeApp(context: Context): Promise<void> {
    if (context.app && context.app.isRunning()) {
        context.app.stop();
        return;
    }
    return;
}
