
const { observable, action, when, reaction } = require('mobx');
const socket = require('../../network/socket');
const SystemWarning = require('./system-warning');
const ServerWarning = require('./server-warning');
const clientApp = require('../client-app');

/**
 * Public API for Warnings system.
 * @namespace
 */
class Warnings {
    /**
     * Observable. Clients should watch this and render new snackbar/dialog on change.
     * @member {SystemWarning} current
     */
    @observable current;

    /**
     * Warnings waiting to get shown.
     * @member {Array<SystemWarning>}
     */
    queue = [];

    /**
     * Some combination of conditions like several reconnects while AFK might create multiple duplicate warnings
     * because server sends them on every reconnect until dismissed.
     * To avoid that we store a cache of unconfirmed server warnings for the session.
     */
    sessionCache = {};

    constructor() {
        reaction(() => clientApp.isFocused, isFocused => {
            if (!this.current || this.current.level !== 'medium') return;
            if (isFocused) {
                this.current.autoDismiss();
            } else {
                this.current.cancelAutoDismiss();
            }
        });
    }

    /**
     * Adds the warning to internal queue.
     * @param {SystemWarning} warning
     */
    queueItem(warning) {
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
        when(() => this.current.state === SystemWarning.STATES.DISMISSED, () => setTimeout(this.assignNextItem));
        if (this.current.level === 'medium' && clientApp.isFocused) this.current.autoDismiss();
        this.current.show();
    }

    /**
     * General method to add warnings. More specialized shortcuts are available.
     * Severe warnings will always get added to the top of the queue.
     * @param {string} content - translation key.
     * @param {string} [title] - optional translation key for title, will not be shown in snackbars.
     * @param {Object} [data] - variables to pass to translator.
     * @param {string} [level='medium'] - severity level.
     * @param {function} [callback] - executes when warning is dismissed
     * @function add
     */
    @action add(content, title, data, level = 'medium', callback) {
        this.queueItem(new SystemWarning(content, title, data, level, callback));
    }

    /**
     * Shortcut to add severe warnings without specifying severity level explicitly.
     * Severe warnings will always get added to the top of the queue.
     * @param {string} content - translation key.
     * @param {string} [title] - optional translation key for title, will not be shown in snackbars.
     * @param {Object} [data] - variables to pass to translator.
     * @param {function} [callback] - executes when warning is dismissed
     * @function addSevere
     */
    @action addSevere(content, title, data, callback) {
        this.add(content, title, data, 'severe', callback);
    }

    /**
     * Adds server warning to the queue.
     * @param {Object} serverObj - as received from server
     * @function addServerWarning
     */
    @action.bound addServerWarning(serverObj) {
        if (serverObj.msg === 'serverWarning_promoConsentRequest') return;
        if (this.sessionCache[serverObj.token]) return;
        this.sessionCache[serverObj.token] = true;
        try {
            const w = new ServerWarning(serverObj, () => { delete this.sessionCache[serverObj.token]; });
            this.queueItem(w);
        } catch (e) {
            console.error(e); // try/catch protects from invalid data sent from server
        }
    }
}

const w = new Warnings();

socket.onceStarted(() => socket.subscribe(socket.APP_EVENTS.serverWarning, w.addServerWarning));

module.exports = w;
