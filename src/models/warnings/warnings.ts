import { observable, action, when, reaction } from 'mobx';

import socket from '../../network/socket';
import clientApp from '../client-app';
import SystemWarning, { WarningStates, WarningLevel } from './system-warning';
import ServerWarning, { ServerWarningData } from './server-warning';

/**
 * Public API for Warnings system.
 */
class Warnings {
    /**
     * Observable. Clients should watch this and render new snackbar/dialog on change.
     */
    @observable current: SystemWarning;

    /**
     * Warnings waiting to get shown.
     */
    private readonly queue: SystemWarning[] = [];

    /**
     * Some combination of conditions like several reconnects while AFK might create multiple duplicate warnings
     * because server sends them on every reconnect until dismissed.
     * To avoid that we store a cache of unconfirmed server warnings for the session.
     */
    private readonly sessionCache = {};

    constructor() {
        reaction(
            () => clientApp.isFocused,
            isFocused => {
                if (!this.current || this.current.level !== 'medium') return;
                if (isFocused) {
                    this.current.autoDismiss();
                } else {
                    this.current.cancelAutoDismiss();
                }
            }
        );
    }

    /**
     * Adds the warning to internal queue.
     */
    queueItem(warning: SystemWarning) {
        if (warning.level === 'severe') {
            this.queue.unshift(warning);
        } else {
            this.queue.push(warning);
        }
        if (!this.current) {
            this.assignNextItem();
        }
    }

    /**
     * Pops next item from queue and makes it current.
     */
    assignNextItem = () => {
        this.current = this.queue.shift();
        if (!this.current) return;
        when(
            () => this.current.state === WarningStates.DISMISSED,
            () => setTimeout(this.assignNextItem)
        );
        if (this.current.level === 'medium' && clientApp.isFocused) this.current.autoDismiss();
        this.current.show();
    };

    /**
     * General method to add warnings. More specialized shortcuts are available.
     * Severe warnings will always get added to the top of the queue.
     * @param content - translation key.
     * @param title - optional translation key for title, will not be shown in snackbars.
     * @param data - variables to pass to translator.
     * @param level - severity level.
     * @param callback - executes when warning is dismissed
     */
    @action
    add(
        content: string,
        title?: string,
        data?: unknown,
        level: WarningLevel = 'medium',
        callback?: () => {}
    ) {
        this.queueItem(new SystemWarning(content, title, data, level, callback));
    }

    /**
     * Shortcut to add severe warnings without specifying severity level explicitly.
     * Severe warnings will always get added to the top of the queue.
     * @param content - translation key.
     * @param title - optional translation key for title, will not be shown in snackbars.
     * @param data - variables to pass to translator.
     * @param callback - executes when warning is dismissed
     */
    @action
    addSevere(content: string, title?: string, data?: unknown, callback?: () => {}) {
        this.add(content, title, data, 'severe', callback);
    }

    /**
     * Adds server warning to the queue.
     * @param serverObj - as received from server
     */
    @action.bound
    addServerWarning(serverObj: ServerWarningData) {
        if (serverObj.msg === 'serverWarning_promoConsentRequest') return;
        if (this.sessionCache[serverObj.token]) return;
        this.sessionCache[serverObj.token] = true;
        try {
            const w = new ServerWarning(serverObj, () => {
                delete this.sessionCache[serverObj.token];
            });
            this.queueItem(w);
        } catch (e) {
            console.error(e); // try/catch protects from invalid data sent from server
        }
    }
}

const warnings = new Warnings();
export default warnings;

socket.onceStarted(() =>
    socket.subscribe(socket.APP_EVENTS.serverWarning, warnings.addServerWarning)
);
