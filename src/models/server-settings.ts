/**
 * Some client configuration details can't be hardcoded to clients or stored in every user database.
 * This module takes care of these settings by loading them from server every time client connects.
 * There's no need for 'updated' events from server because when these settings change server always resets connection.
 */
import socket from '../network/socket';
import { observable, reaction } from 'mobx';
import { retryUntilSuccess } from '../helpers/retry';

class ServerSettings {
    constructor() {
        reaction(
            () => socket.connected,
            connected => {
                if (connected) this.loadSettings();
            },
            { fireImmediately: true }
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
    @observable mixPanelClientToken;

    /**
     * (Re)loads server settings from server.
     */
    loadSettings() {
        retryUntilSuccess(
            () => {
                return socket.send('/noauth/server/settings').then(res => {
                    this.avatarServer = res.fileBaseUrl;
                    this.acceptableClientVersions = res.acceptsClientVersions;
                    this.tag = res.tag;
                    this.maintenanceWindow = res.maintenance;
                    this.mixPanelClientToken = res.mixPanelClientToken;
                    console.log(
                        'Server settings retrieved.',
                        res,
                        '/ tag:',
                        this.tag,
                        '/ file base url:',
                        this.avatarServer,
                        '/ accepts sdk versions:',
                        this.acceptableClientVersions.slice(),
                        '/ maintenance:',
                        this.maintenanceWindow,
                        '/ mixpanel:',
                        this.mixPanelClientToken
                    );
                });
            },
            { id: 'Server Settings Load' }
        );
    }
}

export default new ServerSettings();
