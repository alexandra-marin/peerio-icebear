/**
 * Some client configuration details can't be hardcoded to clients or stored in every user database.
 * This module takes care of these settings by loading them from server every time client connects.
 * There's no need for 'updated' events from server because when these settings change server always resets connection.
 * @namespace ServerSettings
 */
const socket = require('../network/socket');
const { observable, reaction } = require('mobx');
const { retryUntilSuccess } = require('../helpers/retry');

class ServerSettings {
    /**
     * Observable base url for avatars https service
     * @type {string}
     */
    @observable avatarServer = '';
    /**
     * Observable client version range this server can work with.
     * @type {string}
     */
    @observable.ref acceptableClientVersions;
    /**
     * Observable git tag for this server build
     * @type {string}
     */
    @observable tag;

    /**
     * Observable array of timestamps for maintenance begin and end, if applicable.
     * @type {Array}
     */
    @observable maintenanceWindow;

    constructor() {
        reaction(() => socket.authenticated, (authenticated) => {
            if (authenticated) this.loadSettings();
        }, true);
    }
    /**
     * (Re)loads server settings from server.
     */
    loadSettings() {
        retryUntilSuccess(() => {
            return socket.send('/auth/server/settings')
                .then(res => {
                    this.avatarServer = res.fileBaseUrl;
                    this.acceptableClientVersions = res.acceptsClientVersions;
                    this.tag = res.tag;
                    this.maintenanceWindow = res.maintenance;
                    console.log(
                        'Server settings retrieved.', this.tag,
                        this.avatarServer, this.acceptableClientVersions, this.maintenanceWindow
                    );
                });
        }, 'Server Settings Load');
    }
}

module.exports = new ServerSettings();
