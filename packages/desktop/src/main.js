if (process.env.NODE_ENV !== 'development') {
    process.env.NODE_ENV = 'production';
}

/* eslint-disable global-require, import/newline-after-import */
const { app, BrowserWindow, globalShortcut } = require('electron');

let mainWindow;

process.on('uncaughtException', error => {
    console.error('uncaughtException in Node:', error);
});

const isDevEnv = require('~/helpers/is-dev-env').default;

if (!isDevEnv && !process.argv.includes('--allow-multiple-instances')) {
    // In production version, don't allow running more than one instance.
    // This code must be executed as early as possible to prevent the second
    // instance from initializing before it decides to quit.
    const isAnotherInstance = app.makeSingleInstance(() => {
        // Another instance launched, restore the current window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    if (isAnotherInstance) {
        console.log('Another instance is already running, quitting.');
        process.exit();
    }
}

const path = require('path');

// On Windows, change user data path from Electron's default
// %APPDATA% to %LOCALAPPDATA%, since we don't want any of our
// local data to be in the Roaming directory, which is synched
// between machines in some corporate environments.
//
// IMPORTANT: this must be done _before_ requiring config.js.
if (
    process.platform === 'win32' &&
    process.env.LOCALAPPDATA // in case we don't have %LOCALAPPDATA% for some reason
) {
    const oldUserData = app.getPath('userData');
    const newUserData = path.join(process.env.LOCALAPPDATA, app.getName());

    if (oldUserData !== newUserData) {
        try {
            // Since we used to store data in %APPDATA%, we need to move
            // all our old data to into a new directory if the new userData
            // directory doesn't exist.
            //
            // This needs to happen before Electron's app 'ready' event.
            // Also, everything needs to be synchronous.
            //
            // XXX: moving can be removed in the future when older versions
            // of the client are deprecated and everyone's updated.
            const fse = require('fs-extra');
            if (!fse.existsSync(newUserData) && fse.existsSync(oldUserData)) {
                fse.moveSync(oldUserData, newUserData);
                console.log(`Moved ${oldUserData} to ${newUserData}`);
            }

            // Set new paths.
            app.setPath('appData', process.env.LOCALAPPDATA);
            app.setPath('userData', newUserData);
        } catch (e) {
            // Failed to move old folder, so continue using it.
            console.error(e);
        }
    }
}

// For dev builds we want to use separate user data directory
if (isDevEnv) {
    app.setPath(
        'userData',
        path.resolve(
            app.getPath('appData'),
            `${app.getName().toLowerCase()}_dev`
        )
    );
}

// configure logging
require('~/helpers/logging');

const devtools = require('~/main-process/dev-tools');
const buildContextMenu = require('~/main-process/context-menu').default;
const buildGlobalShortcuts = require('~/main-process/global-shortcuts');
const applyMiscHooks = require('~/main-process/misc-hooks');
const {
    saveWindowState,
    getSavedWindowState
} = require('~/main-process/state-persistance');
const setMainMenu = require('~/main-process/main-menu');
const { isAppInDMG, handleLaunchFromDMG } = require('~/main-process/dmg');
const updater = require('./main-process/updater');
const config = require('~/config');

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disk-cache-size', 200 * 1024 * 1024);
app.commandLine.appendSwitch('js-flags', '--harmony_regexp_lookbehind');
if (process.env.REMOTE_DEBUG_PORT !== undefined) {
    app.commandLine.appendSwitch(
        'remote-debugging-port',
        process.env.REMOTE_DEBUG_PORT
    );
}

let mustCloseWindow = false;

app.once('before-quit', () => {
    mustCloseWindow = true;
});

app.on('ready', async () => {
    console.log('Electron ready event - Starting app.');
    buildGlobalShortcuts();
    setMainMenu();
    app.setAppUserModelId(config.appId);

    if (await isAppInDMG()) {
        await handleLaunchFromDMG();
    }

    await config.FileStream.createTempCache();

    const windowState = await getSavedWindowState();
    const winConfig = Object.assign(
        {
            show: false,
            center: true,
            minWidth: 900,
            minHeight: 728,
            title: app.getName()
        },
        windowState
    );

    if (isDevEnv) {
        winConfig.title = `${winConfig.title} DEV`;
        winConfig.icon = `${__dirname}/static/img/icon-dev.png`;
    } else if (process.platform === 'linux') {
        winConfig.icon = `${__dirname}/static/img/icon.png`;
    }

    await devtools.installExtensions();

    mainWindow = new BrowserWindow(winConfig);
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    const rememberWindowState = () => {
        if (mainWindow.isMaximized()) {
            windowState.isMaximized = true;
            return;
        }
        windowState.isMaximized = false;
        if (mainWindow.isMinimized() || mainWindow.isFullScreen()) {
            // don't remember minimized or fullscreen state.
            return;
        }
        Object.assign(windowState, mainWindow.getBounds());
    };

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        if (windowState.isMaximized) {
            mainWindow.maximize();
        }
    });

    mainWindow.on('resize', () => {
        rememberWindowState();
    });

    mainWindow.on('maximize', () => {
        rememberWindowState();
    });

    mainWindow.on('unmaximize', () => {
        rememberWindowState();
    });

    mainWindow.on('restore', () => {
        rememberWindowState();
    });

    mainWindow.on('minimize', () => {
        rememberWindowState();
    });

    const handleClose = async function(e) {
        e.preventDefault();
        try {
            await saveWindowState(windowState);
        } catch (err) {
            console.error(err);
        }
        if (process.platform === 'darwin' && !mustCloseWindow) {
            if (mainWindow.isFullScreen()) {
                mainWindow.setFullScreen(false);
                // Electron doesn't want to hide window until full screen
                // animation is complete and provides no way to know when
                // it completes, so we do our best guess of hiding after
                // 1 second. Worst case if it doesn't work: the user will
                // have to press close again.
                setTimeout(() => {
                    mainWindow.hide();
                }, 1000);
            } else {
                mainWindow.hide();
            }
        } else {
            mainWindow.removeListener('close', handleClose);
            mainWindow.close();
        }
    };

    mainWindow.on('close', handleClose);

    mainWindow.once('closed', () => {
        mainWindow = null;
    });

    applyMiscHooks(mainWindow);
    buildContextMenu(mainWindow);
    devtools.onAppReady(mainWindow);

    if (!(await isAppInDMG())) {
        updater.start(mainWindow);
    }
});

app.on('activate', () => {
    if (mainWindow) {
        mainWindow.show();
    }
});

app.once('will-quit', async e => {
    e.preventDefault();
    try {
        await config.FileStream.deleteTempCache();
        console.log('Cache deleted');
    } catch (err) {
        console.error(err);
    }
    app.quit();
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    app.quit();
});
