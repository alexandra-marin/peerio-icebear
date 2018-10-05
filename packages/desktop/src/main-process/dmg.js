const fs = require('fs');
const { app, dialog } = require('electron');
const TinyDb = require('peerio-icebear/dist/db/tiny-db').default;

const DO_NOT_COPY_SETTING = 'doNotCopyToApplicationsFolder';

async function handleLaunchFromDMG() {
    if (await TinyDb.system.getValue(DO_NOT_COPY_SETTING)) {
        return;
    }

    const canCopy = await canWriteToApplicationsFolder();

    // TODO: localize these dialogs.
    await new Promise(resolve => {
        const appName = app.getName();

        if (!canCopy) {
            // User is not administrator and cannot write to Applications folder.
            // Show a different dialog, reminding not to run from DMG directly.
            //
            // XXX: in theory we shouldn't have to do it since,
            // app.moveToApplicationsFolder() will ask for administrator's
            // credentials; however due to a bug in Electron 1.8.2,
            // it doesn't work. Revisit this later.
            dialog.showMessageBox(
                {
                    type: 'info',
                    message: `${appName} is running from a disk image`,
                    detail:
                        `It is not recommended to run ${appName} directly from the disk image. ` +
                        `Please copy it to the Applications folder and run it from there.`,
                    checkboxLabel: 'Do not show this message again',
                    buttons: ['Quit', 'Launch Anyway'],
                    defaultId: 0,
                    cancelId: 1
                },
                async (response, doNotAsk) => {
                    if (doNotAsk) {
                        await TinyDb.system.setValue(DO_NOT_COPY_SETTING, true);
                    }
                    if (response !== 0) {
                        resolve();
                        return;
                    }
                    app.exit(0);
                }
            );
            return;
        }

        dialog.showMessageBox(
            {
                type: 'question',
                message: 'Copy to Applications folder?',
                detail:
                    `${appName} is running from a disk image. ` +
                    `It is recommended to copy it to the Applications folder and run it from there.`,
                checkboxLabel: 'Do not show this message again',
                buttons: ['Copy to Applications Folder', 'Do Not Copy'],
                defaultId: 0,
                cancelId: 1
            },
            async (response, doNotAsk) => {
                if (doNotAsk) {
                    await TinyDb.system.setValue(DO_NOT_COPY_SETTING, true);
                }
                if (response !== 0) {
                    resolve();
                    return;
                }
                try {
                    // Copy (not move, since we're in read-only DMG) to Applications
                    // and restart if it succeeds.
                    if (!app.moveToApplicationsFolder()) {
                        // Note: the docs are currently wrong, if non-admin user cancels
                        // authorization, an exception gets thrown rather than returning
                        // false. We don't mind.
                        console.log(
                            'User cancelled moving to Applications folder'
                        );
                    }
                } catch (ex) {
                    console.error(ex);
                    dialog.showMessageBox(
                        {
                            type: 'error',
                            message:
                                'Failed to copy the app into the Applications folder',
                            detail:
                                'Please copy it manually by dragging the app icon.',
                            buttons: ['Quit']
                        },
                        () => {
                            app.exit(0);
                        }
                    );
                }
            }
        );
    });
}

function canWriteToApplicationsFolder() {
    return new Promise(resolve => {
        fs.access('/Applications', fs.constants.W_OK, err => {
            resolve(!err);
        });
    });
}

let isInDMG = null; // cached result of isAppInDMG, to avoid disk access

/**
 * Returns a promise resolving to true if the filesystem
 * from which the current process runs is read-only or
 * false if it's not.
 *
 * Applies only to macOS, always resolves to false on other OSes.
 */
function isAppInDMG() {
    return new Promise(resolve => {
        if (isInDMG != null) {
            resolve(isInDMG);
            return;
        }
        if (
            process.platform !== 'darwin' ||
            !process.execPath.startsWith('/Volumes')
        ) {
            isInDMG = false;
            resolve(false);
            return;
        }
        fs.access(process.execPath, fs.constants.W_OK, err => {
            isInDMG = err && err.code === 'EROFS';
            resolve(isInDMG);
        });
    });
}

module.exports = {
    isAppInDMG,
    handleLaunchFromDMG
};
