
const { observable, computed } = require('mobx');
const socket = require('../network/socket');
const { getChatStore } = require('../helpers/di-chat-store');
const { getFileStore } = require('../helpers/di-file-store');
const tracker = require('./update-tracker');
/**
 * This is the place where Icebear can get various state information about client
 * and client can provide such information.
 * Also works as container for high level properties we couldn't find better place for.
 * @namespace ClientApp
 * @public
 */
class ClientApp {
    /**
     * Set this flag when to help Icebear know if user is currently interacting with your app or not.
     * One example of how this affects Icebear behavior:
     * messages will not be marked as 'read' unless isFocused == true
     * @member {boolean} isFocused
     * @memberof ClientApp
     * @public
     */
    @observable isFocused = true;

    /**
     * Use this to let Icebear know if your app is currently showing any of the chats.
     * @member {boolean} isInChatsView
     * @memberof ClientApp
     * @public
     */
    @observable isInChatsView = false;

    /**
     * Use this to let Icebear know if your app is currently showing main file view.
     * @member {boolean} isInFilesView
     * @memberof ClientApp
     * @public
     */
    @observable isInFilesView = false;

    /**
     * Icebear sets this flag.
     * @member {boolean} clientVersionDeprecated
     * @memberof ClientApp
     * @public
     */
    @observable clientVersionDeprecated = false;

    /**
     * Icebear sets this flag.
     * @member {boolean} clientSessionExpired
     * @memberof ClientApp
     * @public
     */
    @observable clientSessionExpired = false;

    /**
     * UI should listen to this and request entering of 2fa code from user and then pass ot back to icebear.
     * @member {TwoFARequest} active2FARequest
     * @memberof ClientApp
     * @public
     */
    @observable active2FARequest = null;

    /**
     * UI should inject observable pref object in here,
     * expected properties:
     *   limitInlineImageSize: bool
     *   externalContentConsented: bool
     *   externalContentEnabled: bool
     *   externalContentJustForFavs: bool,
     *   peerioContentEnabled: bool
     * @memberof ClientApp
     */
    @observable uiUserPrefs = {};

    /**
     * UI should listen to this and request entering of 2fa code from user and then pass ot back to icebear.
     * @member {TwoFARequest} updatingAfterReconnect
     * @memberof ClientApp
     * @public
     */
    @computed get updatingAfterReconnect() {
        return socket.connected && !(
            getChatStore().updatedAfterReconnect
            && getFileStore().updatedAfterReconnect
            && tracker.updatedAfterReconnect
        );
    }

    /**
     * Creates new 2fa request for UI. UI is supposed to show 2fa dialog to user and pass entered code back to icebear.
     * @param {string} type - 'login', 'backupCodes', 'disable' one of the reasons for 2fa request
     * @param {Function<string, ?boolean>} submitCallback, accepts 2fa code and 'trust this device' flag(for login only)
     * @param {?Function} cancelCallback
     * @protected
     */
    create2FARequest(type, submitCallback, cancelCallback) {
        if (!['login', 'backupCodes', 'disable'].includes(type)) {
            throw new Error('Unknown 2fa request type: ', type);
        }
        // deliberately overwriting existing request
        // this should never happen anyway, if it does - it's safer to overwrite
        this.active2FARequest = {
            type,
            submit: (code, trust) => {
                this.active2FARequest = null;
                submitCallback(code, trust);
            },
            cancel: () => {
                this.active2FARequest = null;
                cancelCallback();
            }

        };
    }
}

module.exports = new ClientApp();
