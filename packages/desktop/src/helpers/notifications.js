const { when } = require('mobx');
const sounds = require('~/helpers/sounds');
const uiStore = require('~/stores/ui-store');
const appState = require('~/stores/app-state');
const routerStore = require('~/stores/router-store');
const { contactStore, chatStore, chatInviteStore } = require('peerio-icebear');
const { t } = require('peerio-translator');
const path = require('path');
const { app, getCurrentWindow } = require('electron').remote;
const config = require('~/config');

function bringAppToFront() {
    // Put app window into foreground.
    app.focus();
    const win = getCurrentWindow();
    if (win.isMinimized()) {
        win.restore();
    }
    win.show();
}

const notifications = {};
class MessageNotification {
    constructor(props) {
        this.chat = props.chat;
        this.lastMessageText = props.lastMessageText;
        this.counter = props.unreadCount;
        this.translationKeyword = 'Messages';
        this.userDesktopNotificationCondition =
            uiStore.prefs.messageDesktopNotificationsEnabled;
        this.userSoundsCondition = uiStore.prefs.messageSoundsEnabled;
    }

    send() {
        if (this.userDesktopNotificationCondition)
            this.showDesktopNotification();
        if (this.userSoundsCondition) this.playSound();
    }

    showDesktopNotification() {
        if (!appState.isFocused) {
            let body = this.lastMessageText;
            if (this.counter >= config.chat.pageSize) {
                body = t(`notification_manyNew${this.translationKeyword}`);
            }
            if (this.counter > 1) {
                body = t(`notification_new${this.translationKeyword}`, {
                    count: this.counter
                });
            }
            this.postDesktopNotification(this.chat.name, body);
        }
    }

    playSound() {
        sounds.received.play();
    }

    handleClick = () => {
        if (this.chat) {
            bringAppToFront();

            // Activate chat.
            routerStore.navigateTo(routerStore.ROUTES.chats);
            chatStore.activate(this.chat.id);

            // Focus on message input.
            uiStore.focusMessageInput();
        }
    };

    postDesktopNotification(title, body) {
        if (!title || !body) return;
        // replace existing notification -- only one per chat
        if (notifications[this.chat.id]) {
            notifications[this.chat.id].close();
        }
        const props = {
            body,
            silent: true
        };

        // icon needed for Windows, looks weird on Mac
        if (config.os !== 'Darwin')
            props.icon = path.join(
                app.getAppPath(),
                'build/static/img/notification-icon.png'
            );

        const notification = new Notification(title, props);
        notification.onclick = this.handleClick;
        notifications[this.chat.id] = notification;
    }
}

class MentionNotification extends MessageNotification {
    constructor(props) {
        super(props);
        this.userDesktopNotificationCondition =
            uiStore.prefs.mentionDesktopNotificationsEnabled;
        this.userSoundsCondition = uiStore.prefs.mentionSoundsEnabled;
        this.translationKeyword = 'Mentions';
        this.counter =
            this.unreadCount > config.chat.pageSize
                ? this.unreadCount
                : this.freshBatchMentionCount;
    }
}

class DMNotification extends MessageNotification {
    constructor(props) {
        super(props);
        this.userDesktopNotificationCondition =
            uiStore.prefs.mentionDesktopNotificationsEnabled;
        this.userSoundsCondition = uiStore.prefs.mentionSoundsEnabled;
        this.translationKeyword = 'DMs';
        this.counter =
            this.unreadCount > config.chat.pageSize
                ? this.unreadCount
                : this.freshBatchMentionCount;
    }
}

function sendMessageNotification(props) {
    if (props.chat.otherParticipants.length <= 1) {
        const m = new DMNotification(props);
        m.send();
    } else if (props.freshBatchMentionCount) {
        const m = new MentionNotification(props);
        m.send();
    }
    const m = new MessageNotification(props);
    m.send();
}

class InviteNotification {
    constructor(props) {
        this.invite = props.invite;
        this.userDesktopNotificationCondition =
            uiStore.prefs.inviteDesktopNotificationsEnabled;
        this.userSoundsCondition = uiStore.prefs.messageSoundsEnabled;
    }

    send() {
        if (this.userDesktopNotificationCondition)
            this.showDesktopNotification();
        if (this.userSoundsCondition) this.playSound();
    }

    showDesktopNotification() {
        if (!appState.isFocused) {
            const { username, channelName } = this.invite;
            const contact = contactStore.getContact(username);
            when(
                () => !contact.loading,
                () => {
                    this.postDesktopNotification(
                        t('notification_roomInviteTitle'),
                        t('notification_roomInviteBody', {
                            name: contact.fullName,
                            room: channelName
                        })
                    );
                }
            );
        }
    }

    playSound() {
        sounds.received.play();
    }

    handleClick = () => {
        if (this.invite) {
            bringAppToFront();

            // Activate invite
            // "when" is needed because notification can arrive and be clicked
            // before chatStore is loaded, which causes lots of confusion in UI.
            when(
                () => chatStore.loaded,
                () => {
                    chatInviteStore.activateInvite(this.invite.kegDbId);
                    if (chatInviteStore.activeInvite) {
                        chatStore.deactivateCurrentChat();
                        routerStore.navigateTo(
                            routerStore.ROUTES.channelInvite
                        );
                    }
                }
            );
        }
    };

    postDesktopNotification(title, body) {
        if (!title || !body) return;
        const props = {
            body,
            silent: true
        };

        // icon needed for Windows, looks weird on Mac
        if (config.os !== 'Darwin')
            props.icon = path.join(
                app.getAppPath(),
                'build/static/img/notification-icon.png'
            );

        const notification = new Notification(title, props);
        notification.onclick = this.handleClick;
    }
}

function sendInviteNotification(props) {
    const n = new InviteNotification(props);
    n.send();
}

// TODO: all of these notification classes are very similar, can we abstract them?
class InviteAcceptedNotification {
    constructor(props) {
        this.contact = props.contact;
        this.userDesktopNotificationCondition = true; // TODO: for now this notif is always on
        this.userSoundsCondition = uiStore.prefs.messageSoundsEnabled;
    }

    send() {
        if (this.userDesktopNotificationCondition)
            this.showDesktopNotification();
        if (this.userSoundsCondition) this.playSound();
    }

    showDesktopNotification() {
        if (!appState.isFocused) {
            const { username } = this.contact;
            if (!username) return;
            const contact = contactStore.getContact(username);

            this.postDesktopNotification(
                t('notification_inviteAcceptedTitle'),
                t('notification_inviteAcceptedBody', {
                    firstName: contact.firstName || '',
                    username
                })
            );
        }
    }

    playSound() {
        sounds.received.play();
    }

    handleClick = () => {
        if (this.invite) {
            bringAppToFront();

            // Activate invite
            // "when" is needed because notification can arrive and be clicked
            // before chatStore is loaded, which causes lots of confusion in UI.
            when(
                () => chatStore.loaded,
                () => {
                    chatInviteStore.activateInvite(this.invite.kegDbId);
                    if (chatInviteStore.activeInvite) {
                        chatStore.deactivateCurrentChat();
                        routerStore.navigateTo(
                            routerStore.ROUTES.channelInvite
                        );
                    }
                }
            );
        }
    };

    postDesktopNotification(title, body) {
        if (!title || !body) return;
        const props = {
            body,
            silent: true
        };

        // icon needed for Windows, looks weird on Mac
        if (config.os !== 'Darwin')
            props.icon = path.join(
                app.getAppPath(),
                'build/static/img/notification-icon.png'
            );

        const notification = new Notification(title, props);
        notification.onclick = this.handleClick;
    }
}

function sendInviteAcceptedNotification(props) {
    const n = new InviteAcceptedNotification(props);
    n.send();
}

module.exports = {
    sendMessageNotification,
    sendInviteNotification,
    sendInviteAcceptedNotification
};
