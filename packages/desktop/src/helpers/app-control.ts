import electron from 'electron';
import config from '~/config';

const app = electron.app || electron.remote.app;

/**
 * Restarts application
 * @param force - if true, will restart immediately, no events fired, questions
 *                asked, no unsaved work saved
 */
export function relaunch(force = false) {
    config.FileStream.deleteTempCache();
    app.relaunch();
    force ? app.exit(0) : app.quit();
}

export async function signout() {
    const autologin = require('~/helpers/autologin');
    const { User } = require('peerio-icebear');
    await autologin.disable();
    await User.current.signout();
    relaunch();
}
