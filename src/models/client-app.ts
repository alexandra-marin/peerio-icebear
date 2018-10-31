import { observable, computed } from 'mobx';
import socket from '../network/socket';
import { getChatStore } from '../helpers/di-chat-store';
import { getFileStore } from '../helpers/di-file-store';
import tracker from './update-tracker';
import { TwoFARequest } from '../defs/interfaces';

// settings to control icebear behaviour towards internal and external media content in chats
interface ChatContentPrefs {
    limitInlineImageSize?: boolean;
    externalContentConsented?: boolean;
    externalContentEnabled?: boolean;
    externalContentJustForFavs?: boolean;
    peerioContentEnabled?: boolean;
}
/**
 * This is the place where Icebear can get various state information about client
 * and client can provide such information.
 * Also works as container for high level properties we couldn't find better place for.
 */
export class ClientApp {
    /**
     * Set this flag when to help Icebear know if user is currently interacting with your app or not.
     * One example of how this affects Icebear behavior:
     * messages will not be marked as 'read' unless isFocused == true
     */
    @observable isFocused = true;

    /**
     * Use this to let Icebear know if your app is currently showing any of the chats.
     */
    @observable isInChatsView = false;

    /**
     * Use this to let Icebear know if your app is currently showing main file view.
     */
    @observable isInFilesView = false;

    /**
     * Icebear sets this flag.
     */
    @observable clientVersionDeprecated = false;

    /**
     * Icebear sets this flag.
     */
    @observable clientSessionExpired = false;

    /**
     * UI should listen to this and request entering of 2fa code from user and then pass ot back to icebear.
     */
    @observable active2FARequest: TwoFARequest = null;

    /**
     * UI should inject observable pref object in here,
     */
    @observable uiUserPrefs: ChatContentPrefs = {};

    /**
     * UI should listen to this to determine whether or not to show "scroll to bottom" button
     * and SDK should listen to determine whether to mark messages as read
     */
    @observable isReadingNewestMessages = true;

    /**
     * UI should listen to this and request entering of 2fa code from user and then pass ot back to icebear.
     */
    @computed
    get updatingAfterReconnect() {
        return (
            socket.connected &&
            !(
                getChatStore().updatedAfterReconnect &&
                getFileStore().updatedAfterReconnect &&
                tracker.updated
            )
        );
    }

    /**
     * Creates new 2fa request for UI. UI is supposed to show 2fa dialog to user and pass entered code back to icebear.
     * @param type -  one of the reasons for 2fa request
     * @param submitCallback - accepts 2fa code and 'trust this device' flag(for login only)
     */
    create2FARequest(
        type: 'login' | 'backupCodes' | 'disable',
        submitCallback: (code: string, trust?: boolean) => Promise<void>,
        cancelCallback?: () => void
    ) {
        // deliberately overwriting existing request
        // this should never happen anyway, if it does - it's safer to overwrite
        this.active2FARequest = {
            type,
            submit: (code, trust) => {
                this.active2FARequest = null;
                return submitCallback(code, trust);
            },
            cancel: () => {
                this.active2FARequest = null;
                if (cancelCallback) cancelCallback();
            }
        };
    }
}

export default new ClientApp();
