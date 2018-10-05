const React = require('react');
const { autorunAsync, observable, action, computed } = require('mobx');
const { observer } = require('mobx-react');
const { Avatar, Divider, Menu, MenuHeader, MenuItem } = require('peer-ui');
const { User, contactStore, chatStore, fileStore } = require('peerio-icebear');
const UsageCloud = require('~/ui/shared-components/UsageCloud');
const SignoutDialog = require('~/ui/shared-components/SignoutDialog');
const css = require('classnames');
const { remote } = require('electron');
const notificationFactory = require('~/helpers/notifications');
const appControl = require('~/helpers/app-control');
const { t } = require('peerio-translator');
const routerStore = require('~/stores/router-store');
const urls = require('~/config').translator.urlMap;
const autologin = require('~/helpers/autologin');
const path = require('path');
const config = require('~/config');
const AppNavBeaconedItem = require('./AppNavBeaconedItem');

const { app, nativeImage } = remote;

// todo: move this somewhere more appropriate
let dockNotifsStarted = false;
function startDockNotifications() {
    // if (dockNotifsStarted || (!app.setBadgeCount && !app.dock && !app.dock.bounce)) return;
    if (dockNotifsStarted) return;
    dockNotifsStarted = true;
    autorunAsync(() => {
        const unreadItems = chatStore.unreadMessages;
        // mac
        if (app.setBadgeCount && app.dock && app.dock.bounce) {
            if (app.setBadgeCount) app.setBadgeCount(unreadItems);
            if (unreadItems > 0) {
                app.dock.bounce();
            }
        }
    }, 250);
}

let taskbarOverlayStarted = false;
function startTaskbarOverlay() {
    // if (dockNotifsStarted || (!app.setBadgeCount && !app.dock && !app.dock.bounce)) return;
    if (taskbarOverlayStarted) return;
    taskbarOverlayStarted = true;
    autorunAsync(() => {
        const unreadItems = chatStore.unreadMessages;
        // windows
        if (typeof remote.getCurrentWindow().setOverlayIcon === 'function') {
            const overlay = nativeImage.createFromPath(
                path.join(
                    app.getAppPath(),
                    'build/static/img/taskbar-overlay.png'
                )
            );
            remote
                .getCurrentWindow()
                .setOverlayIcon(
                    unreadItems ? overlay : null,
                    unreadItems ? 'newmessages' : ''
                );
        }
    }, 250);
}

let desktopNotificationsStarted = false;
function startDesktopNotifications() {
    if (desktopNotificationsStarted) return;
    desktopNotificationsStarted = true;
    chatStore.events.on(
        chatStore.EVENT_TYPES.messagesReceived,
        notificationFactory.sendMessageNotification
    );
    chatStore.events.on(
        chatStore.EVENT_TYPES.invitedToChannel,
        notificationFactory.sendInviteNotification
    );
    contactStore.events.on(
        contactStore.EVENT_TYPES.inviteAccepted,
        notificationFactory.sendInviteAcceptedNotification
    );
}

@observer
class AppNav extends React.Component {
    @observable isConfirmSignOutVisible = false;

    constructor() {
        super();
        [
            'mail',
            'chats',
            'files',
            'contacts',
            'profile',
            'security',
            'prefs',
            'account',
            'about',
            'help',
            'onboarding'
        ].forEach(route => {
            this[`to${route[0].toUpperCase()}${route.slice(1)}`] = () => {
                this.enableColorIcons();
                routerStore.navigateTo(routerStore.ROUTES[route]);
            };
        });
    }

    componentWillMount() {
        // since this component shows new items notifications, we also make it show dock icon notifications
        startDockNotifications();
        startDesktopNotifications();
        startTaskbarOverlay();
    }

    @computed
    get menuItems() {
        const hideUpgrade =
            config.disablePayments || User.current.hasActivePlans;

        const menuContent = [
            {
                value: 'Profile',
                customIcon: 'public-profile',
                caption: 'title_settingsProfile',
                className: css('profile', 'custom-icon-hover-container', {
                    'avatar-notify': !User.current.primaryAddressConfirmed
                })
            },
            {
                value: 'Security',
                icon: 'security',
                caption: 'title_settingsSecurity'
            },
            {
                value: 'Preferences',
                customIcon: 'preferences',
                caption: 'title_settingsPreferences',
                className: 'preferences custom-icon-hover-container',
                route: 'prefs',
                clickFunction: 'toPrefs'
            },
            {
                value: 'Account',
                icon: 'account_circle',
                caption: 'title_settingsAccount'
            },
            {
                value: 'About',
                icon: 'info',
                caption: 'title_About'
            },
            {
                value: 'Help',
                icon: 'help',
                caption: 'title_help'
            },
            {
                hidden: hideUpgrade,
                divider: true
            },
            {
                hidden: hideUpgrade,
                value: 'Upgrade',
                icon: 'open_in_browser',
                caption: 'button_upgrade'
            },
            {
                divider: true
            },
            {
                value: 'Signout',
                icon: 'power_settings_new',
                caption: 'button_logout',
                clickFunction: 'signout'
            }
        ];

        return menuContent.map((m, i) => {
            if (m.hidden) return null;
            if (m.divider) return <Divider key={`divider-${i}`} />; // eslint-disable-line

            const value = m.value.toLowerCase();
            const className = m.className ? m.className : value;
            const route = m.route ? m.route : value;
            const clickFunction = m.clickFunction
                ? m.clickFunction
                : `to${m.value}`;

            return (
                <MenuItem
                    key={value}
                    value={value}
                    caption={t(m.caption)}
                    className={className}
                    icon={m.icon}
                    customIcon={m.customIcon}
                    selected={
                        routerStore.currentRoute === routerStore.ROUTES[route]
                    }
                    onClick={this[clickFunction]}
                />
            );
        });
    }

    @observable colorIcons = true;
    @action.bound
    enableColorIcons() {
        this.colorIcons = true;
    }
    @action.bound
    disableColorIcons() {
        this.colorIcons = false;
    }

    _doSignout = async untrust => {
        await autologin.disable();
        await User.current.signout(untrust);
        appControl.relaunch();
    };

    signout = async () => {
        this.isConfirmSignOutVisible = true;
    };

    cancelSignout = () => {
        this.isConfirmSignOutVisible = false;
    };

    toUpgrade() {
        return window.open(urls.upgrade);
    }

    render() {
        const contact = contactStore.getContact(User.current.username);
        const { currentRoute, ROUTES } = routerStore;
        const { primaryAddressConfirmed } = User.current;

        return (
            <div className="app-nav">
                <div className="avatar-menu-wrapper">
                    <div
                        className={css({
                            'avatar-notify': !primaryAddressConfirmed
                        })}
                    />
                    <Menu
                        customButton={
                            <Avatar contact={contact} size="medium" />
                        }
                        position="top-left"
                        theme="wide"
                        innerClassName={css('app-nav-menu', {
                            'color-icons': this.colorIcons
                        })}
                    >
                        <MenuHeader
                            leftContent={
                                <Avatar
                                    contact={contact}
                                    size="medium"
                                    onClick={this.toProfile}
                                />
                            }
                            caption={contact.fullName}
                            legend={contact.username}
                        />
                        <Divider />
                        <div
                            onMouseEnter={this.disableColorIcons}
                            onMouseLeave={this.enableColorIcons}
                        >
                            {this.menuItems}
                        </div>
                    </Menu>
                </div>
                <div className="app-menu">
                    <AppNavBeaconedItem
                        beaconName="chat"
                        tooltip={t('title_chats')}
                        icon="forum"
                        active={
                            currentRoute.startsWith(ROUTES.chats) ||
                            currentRoute.startsWith(ROUTES.patients)
                        }
                        showBadge={chatStore.badgeCount > 0}
                        badge={chatStore.badgeCount}
                        onClick={this.toChats}
                    />
                    <AppNavBeaconedItem
                        beaconName="files"
                        tooltip={t('title_files')}
                        icon="folder"
                        active={currentRoute.startsWith(ROUTES.files)}
                        showBadge={fileStore.unreadFiles > 0}
                        onClick={this.toFiles}
                    />
                    <AppNavBeaconedItem
                        beaconName="contact"
                        tooltip={t('title_contacts')}
                        icon="people"
                        active={currentRoute.startsWith(ROUTES.contacts)}
                        onClick={this.toContacts}
                    />
                    <UsageCloud onClick={this.toOnboarding} />
                </div>
                <SignoutDialog
                    active={this.isConfirmSignOutVisible}
                    onHide={this.cancelSignout}
                    onSignout={this._doSignout}
                />
            </div>
        );
    }
}

module.exports = AppNav;
