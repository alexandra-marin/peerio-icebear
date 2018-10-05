const path = require('path');
const isDevEnv = require('~/helpers/is-dev-env').default;
const { app, ipcMain } = require('electron');
const TinyDb = require('peerio-icebear/dist/db/tiny-db').default;
const autoUpdater = require('@peerio/updater')();

TinyDb.system
    .getValue('pref_prereleaseUpdatesEnabled')
    .then(enabled => {
        autoUpdater.allowPrerelease = !!enabled;
        console.log(
            `Prerelease updates are ${
                autoUpdater.allowPrerelease ? 'enabled' : 'disabled'
            }`
        );
    })
    .catch(err => {
        console.error(
            'Failed to retrieve prerelease update setting from TinyDb',
            err
        );
    });

function start(mainWindow) {
    function sendStatusToMainWindow(text) {
        console.log(text);
        mainWindow.webContents.send('console_log', text);
    }

    try {
        autoUpdater.setDownloadsDirectory(
            path.join(app.getPath('userData'), 'Updates')
        );

        // Handlers for events from renderer process.

        ipcMain.on('update-check', () => {
            autoUpdater.checkForUpdates();
        });

        ipcMain.on('update-install', () => {
            console.log('Client approved update installation.');
            app.releaseSingleInstance();
            autoUpdater.quitAndInstall();
        });

        ipcMain.on('update-schedule-install', () => {
            console.log('Scheduling update installation on quit');
            autoUpdater.scheduleInstallOnQuit();
        });

        ipcMain.on('update-retry-install', () => {
            console.log('Retrying update installation.');
            app.releaseSingleInstance();
            autoUpdater.quitAndRetryInstall();
        });

        ipcMain.on('update-check-last-failed', async () => {
            if (!autoUpdater) return;

            const failedAttempts = await autoUpdater.failedInstallAttempts();
            if (!failedAttempts) {
                autoUpdater.cleanup(); // don't care to await it
            }
            mainWindow.webContents.send(
                'update-failed-attempts',
                failedAttempts
            );
        });

        ipcMain.on('update-cleanup', async () => {
            await autoUpdater.cleanup();
            mainWindow.webContents.send('update-cleanup-done');
        });

        // Redirect updater events to renderer process.

        autoUpdater.on('checking-for-update', () => {
            mainWindow.webContents.send('checking-for-update');
        });

        autoUpdater.on('update-available', info => {
            mainWindow.webContents.send('update-available', info);
        });

        autoUpdater.on('update-not-available', info => {
            mainWindow.webContents.send('update-not-available', info);
        });

        autoUpdater.on('error', err => {
            mainWindow.webContents.send('update-error', err);
        });

        autoUpdater.on(
            'update-downloaded',
            (downloadedFile, manifest, mandatory) => {
                mainWindow.webContents.send(
                    'update-downloaded',
                    downloadedFile,
                    manifest,
                    mandatory
                );
            }
        );

        if (!isDevEnv) {
            autoUpdater.failedInstallAttempts().then(failed => {
                if (!failed) {
                    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
                    setInterval(
                        () => autoUpdater.checkForUpdates(),
                        60 * 60 * 1000
                    );
                }
            });
        } else {
            sendStatusToMainWindow(
                'Updater did not start because dev build was detected.'
            );
        }
    } catch (ex) {
        console.error('Error starting updater', ex);
        sendStatusToMainWindow('Error starting updater.');
        sendStatusToMainWindow(String(ex));
    }
}

module.exports = { start };
