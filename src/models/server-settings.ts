/**
 * Some client configuration details can't be hardcoded to clients or stored in every user database.
 * This module takes care of these settings by loading them from server every time client connects.
 * There's no need for 'updated' events from server because when these settings change server always resets connection.
 * @namespace ServerSettings
 */
import socket from '../network/socket';
import { observable, reaction } from 'mobx';
import { retryUntilSuccess } from '../helpers/retry';

class ServerSettings {
    constructor() {
        reaction(
            () => socket.authenticated,
            authenticated => {
                if (authenticated) this.loadSettings();
            },
            true
        );
    }
    /**
     * Observable base url for avatars https service
     */
    @observable avatarServer = '';
    /**
     * Observable client version range this server can work with.
     */
    @observable acceptableClientVersions: string[];
    /**
     * Observable git tag for this server build
     */
    @observable tag: string;

    /**
     * Observable array of timestamps for maintenance begin and end, if applicable.
     */
    @observable maintenanceWindow: number[];

    /**
     * (Re)loads server settings from server.
     */
    loadSettings() {
        retryUntilSuccess(() => {
            return socket.send('/auth/server/settings').then(res => {
                this.avatarServer = res.fileBaseUrl;
                this.acceptableClientVersions = res.acceptsClientVersions;
                this.tag = res.tag;
                this.maintenanceWindow = res.maintenance;
                console.log(
                    'Server settings retrieved.',
                    this.tag,
                    this.avatarServer,
                    this.acceptableClientVersions,
                    this.maintenanceWindow
                );
            });
        }, 'Server Settings Load');
    }
}

export default new ServerSettings();
