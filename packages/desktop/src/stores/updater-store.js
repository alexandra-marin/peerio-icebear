const { observable, when } = require('mobx');
const { ipcRenderer } = require('electron');
const { clientApp, warnings } = require('peerio-icebear');

class UpdaterStore {
    /**
     * If true, the last update failed.
     * Set during the launch.
     */
    @observable lastUpdateFailed = false;

    /**
     * The number of install attempts the failed update had.
     */
    @observable lastUpdateInstallAttempts = 0;

    /**
     * If true, update checking is in progress.
     */
    @observable checking = false;

    /**
     * If true, the update is downloading.
     */
    @observable downloading = false;

    /**
     * If true, the update has been downloaded
     * and is ready to install.
     *
     * Not set when retrying the update installation.
     */
    @observable readyToInstall = false;

    /**
     * If true, the user should be asked to install
     * the update.
     */
    @observable askToInstall = false;

    /**
     * If true, the update is mandatory and
     * must be installed immediately.
     *
     * Value is set after 'update-downloaded' event.
     */
    @observable mandatory = false;

    /**
     * If true, the update is being installed
     * (including when retrying install).
     */
    @observable installing = false;

    /**
     * Error reason, if any.
     */
    @observable error = null;

    constructor() {
        // Set up event handlers.
        ipcRenderer.on('update-failed-attempts', (ev, failedAttempts) => {
            this.lastUpdateFailed = failedAttempts > 0;
            this.lastUpdateInstallAttempts = failedAttempts;
            if (failedAttempts === 1) {
                // After a single failure, retry immediately
                // without asking the user.
                this.quitAndRetryInstall();
            }
        });

        ipcRenderer.on(
            'update-downloaded',
            (ev, downloadedFile, manifest, mandatory) => {
                console.log('Update downloaded');
                this.mandatory = mandatory || clientApp.clientVersionDeprecated;
                this.readyToInstall = true;
                this.scheduleInstallOnQuit();
                if (this.mandatory) {
                    this.askToInstall = true;
                } else {
                    // Turn on askToInstall flag in 12 hours (and every 12 hours after that)
                    // to remind to install updates if the app didn't quit.
                    // We ask nicely 2 times, but the 3rd time the update will be mandatory.
                    let askCount = 0;
                    setInterval(() => {
                        if (this.installing) return;
                        if (askCount++ >= 2) {
                            this.mandatory = true;
                        }
                        this.askToInstall = true;
                    }, 12 * 60 * 60 * 1000);
                    warnings.add('title_updateWillBeInstalled');
                }
            }
        );

        ipcRenderer.on('checking-for-update', () => {
            this.checking = true;
            console.log('Checking for update');
        });

        ipcRenderer.on('update-available', (ev, info) => {
            this.checking = false;
            this.downloading = true;
            console.log('Update available.', info);
            warnings.add('title_updateDownloading');
        });

        ipcRenderer.on('update-not-available', (ev, info) => {
            this.checking = false;
            console.log('Update not available.', info);
        });

        ipcRenderer.on('update-error', (ev, err) => {
            this.error = err;
            console.error('Update error:', err);
        });

        // Request to check if last update failed.
        ipcRenderer.send('update-check-last-failed');

        // Force check and install if client is deprecated.
        when(
            () => clientApp.clientVersionDeprecated,
            () => {
                this.quitAndRetryInstall();
            }
        );
    }

    cleanup() {
        return new Promise(resolve => {
            ipcRenderer.once('update-cleanup-done', () => {
                resolve();
            });
            ipcRenderer.send('update-cleanup');
        });
    }

    check() {
        ipcRenderer.send('update-check');
    }

    scheduleInstallOnQuit() {
        if (this.installing) return;
        ipcRenderer.send('update-schedule-install');
    }

    quitAndInstall() {
        if (this.installing) return;
        this.readyToInstall = false;
        this.installing = true;
        ipcRenderer.send('update-install');
    }

    quitAndRetryInstall() {
        if (this.installing || this.checking || this.downloading) return;
        this.readyToInstall = false;
        this.installing = true;
        ipcRenderer.send('update-retry-install');
    }
}

module.exports = new UpdaterStore();
