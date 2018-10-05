import React from 'react';
import { action, computed, observable } from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';
import FlipMove from 'react-flip-move';
import _ from 'lodash';

import { t } from 'peerio-translator';
import { chatStore, chatInviteStore } from 'peerio-icebear';
import {
    Button,
    List,
    ListItem,
    MaterialIcon,
    ProgressBar,
    Tooltip
} from 'peer-ui';

import routerStore from '~/stores/router-store';
import T from '~/ui/shared-components/T';
import AvatarWithPopup from '~/ui/contact/components/AvatarWithPopup';
import PlusIcon from '~/ui/shared-components/PlusIcon';
import MaintenanceWarning from '~/ui/shared-components/MaintenanceWarning';
import { getAttributeInParentChain } from '~/helpers/dom';
import PatientList from '~/whitelabel/components/PatientList';
import ELEMENTS from '~/whitelabel/helpers/elements';

import PlusIconBeaconed from './PlusIconBeaconed';

// Variables to calculate position-in-window of unread messages
const paddingTop = 20;
const paddingMiddle = 16;
const paddingBottom = 8;
const buttonHeight = 48;
const roomHeight = 26;
const dmHeight = 44;
const notifHeight = 46;

@observer
export default class ChatList extends React.Component {
    componentDidMount() {
        // TODO: refactor when SDK is there for chat invites
        if (
            !chatStore.chats.length &&
            !chatInviteStore.activeInvite &&
            chatInviteStore.received.length
        ) {
            this.activateInvite(chatInviteStore.received[0].kegDbId);
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.checkScrollHeight);
        if (this.scrollContainerRef)
            this.scrollContainerRef.removeEventListener(
                'scroll',
                this.checkScrollDistance
            );
        window.removeEventListener('resize', this.checkScrollDistance);
    }

    // Building the rooms & invites list
    @computed
    get allRooms(): any[] {
        return ELEMENTS.chatList.allRooms;
    }

    @computed
    get allRoomsMap() {
        return this.allRooms.map(r => {
            if (!r.metaLoaded) return null;
            return r.isChannel ? (
                <ListItem
                    data-chatid={r.id}
                    key={r.id || r.tempId}
                    className={css('room-item', {
                        active: r.active,
                        unread: r.unreadCount > 0
                    })}
                    caption={`# ${r.name}`}
                    onClick={this.activateChat}
                    rightContent={
                        (!r.active || r.newMessagesMarkerPos) &&
                        r.unreadCount > 0 ? (
                            <div className="notification">
                                {r.unreadCount < 100 ? r.unreadCount : '99+'}
                            </div>
                        ) : null
                    }
                />
            ) : (
                <ListItem
                    data-kegdbid={r.kegDbId}
                    key={`invite:${r.kegDbId}`}
                    className={css('room-item', 'room-invite-item', 'unread', {
                        active:
                            chatInviteStore.activeInvite &&
                            chatInviteStore.activeInvite.kegDbId === r.kegDbId
                    })}
                    onClick={this.activateInviteByEvent}
                    caption={`# ${r.channelName}`}
                    rightContent={<T k="title_new" className="badge-new" />}
                />
            );
        });
    }

    // Building the DM list
    @computed
    get dmMap() {
        // TODO/TS: any
        return (chatStore.directMessages as any[]).map(c => {
            if (!c.metaLoaded) return null;
            let rightContent: JSX.Element | null = null;
            let contact =
                c.otherParticipants.length > 0
                    ? c.otherParticipants[0]
                    : c.allParticipants[0];
            if (c.isInvite) {
                rightContent = <T k="title_new" className="badge-new" />;
                contact = c.contact;
            } else if (
                (!c.active || c.newMessagesMarkerPos) &&
                c.unreadCount > 0
            ) {
                rightContent = (
                    <div className="notification">
                        {c.unreadCount < 100 ? c.unreadCount : '99+'}
                    </div>
                );
            }
            return (
                <ListItem
                    data-chatid={c.id}
                    key={c.id || c.tempId}
                    className={css('dm-item', {
                        active: c.active,
                        unread: c.unreadCount > 0,
                        pinned: c.isFavorite
                    })}
                    leftContent={
                        <AvatarWithPopup
                            key="a"
                            contact={contact}
                            size="small"
                            tooltip
                        />
                    }
                    onClick={this.activateChat}
                    rightContent={rightContent}
                >
                    {c.name}
                </ListItem>
            );
        });
    }

    // Calculating the positions of unread messages relative to scroll container
    // TODO: this will be thrown off by PatientList
    @computed
    get unreadPositions() {
        const positionsArray: number[] = [];

        const unreadRooms = this.allRooms.reduce((acc, room, i) => {
            if (!room.active && room.unreadCount > 0) {
                acc.push(i);
            }
            return acc;
        }, []);

        const roomsOffset = paddingTop + buttonHeight;
        unreadRooms.forEach(i => {
            positionsArray.push(roomsOffset + i * roomHeight);
        });

        const unreadDMs = chatStore.directMessages.reduce((acc, chat, i) => {
            if (!chat.active && chat.unreadCount > 0) {
                acc.push(i);
            }
            return acc;
        }, []);

        const dmsOffset =
            roomsOffset +
            this.allRooms.length * roomHeight +
            paddingMiddle +
            buttonHeight;
        unreadDMs.forEach(i => {
            positionsArray.push(dmsOffset + i * dmHeight);
        });

        return positionsArray;
    }

    // Calculations to determine if unread messages are out of view
    @observable scrollContainerRef: HTMLElement | null = null;
    @action.bound
    setScrollContainerRef(ref: HTMLElement | null) {
        if (!ref) {
            this.scrollContainerRef = null;
            return;
        }

        this.scrollContainerRef = ref;
        this.checkScrollHeight();
        window.addEventListener('resize', this.checkScrollHeight);

        this.checkScrollDistance();
        ref.addEventListener('scroll', this.checkScrollDistance);
        window.addEventListener('resize', this.checkScrollDistance);
    }

    @observable scrollContainerHeight: number;
    @action.bound
    checkScrollHeight() {
        this.scrollContainerHeight = this.scrollContainerRef!.clientHeight;
    }

    @observable scrollDistance: number;
    @action.bound
    checkScrollDistance = _.throttle(() => {
        this.scrollDistance = this.scrollContainerRef!.scrollTop;
    }, 250);

    // Calculate the next and previous unread message that's offscreen
    @computed
    get containerTotalHeight() {
        return (
            paddingTop +
            paddingMiddle +
            paddingBottom +
            2 * buttonHeight +
            this.allRooms.length * roomHeight +
            chatStore.directMessages.length * dmHeight
        );
    }

    @computed
    get nextUnread(): number {
        let next;
        for (let i = this.unreadPositions.length - 1; i >= 0; i--) {
            if (
                this.scrollDistance + this.scrollContainerHeight - dmHeight >
                this.unreadPositions[i]
            )
                break;
            next = this.unreadPositions[i] - notifHeight;
        }
        return next;
    }

    @computed
    get prevUnread(): number {
        let prev;
        for (let i = 0; i < this.unreadPositions.length; i++) {
            if (this.scrollDistance < this.unreadPositions[i]) break;
            prev = this.unreadPositions[i] - notifHeight;
        }
        return prev;
    }

    // Scroll-to-position when clicking "unread messages" notification
    @observable goalUnread: number;
    @action.bound
    clickUnreadsAbove() {
        this.goalUnread = this.prevUnread;
        window.requestAnimationFrame(this.smoothScrollUp);
    }
    @action.bound
    clickUnreadsBelow() {
        this.goalUnread = this.nextUnread;
        window.requestAnimationFrame(this.smoothScrollDown);
    }

    readonly smoothScrollUp = () => {
        const el = this.scrollContainerRef;
        if (!el) return;

        const goal = this.goalUnread;
        if (el.scrollTop <= goal || el.scrollTop === 0) {
            return;
        }

        el.scrollTop -= (el.scrollTop - goal) / 8 + 1;
        window.requestAnimationFrame(this.smoothScrollUp);
    };

    readonly smoothScrollDown = () => {
        const el = this.scrollContainerRef;
        if (!el) return;

        const goal = this.goalUnread;
        if (
            el.scrollTop >= goal ||
            el.scrollTop + el.clientHeight >= this.containerTotalHeight
        ) {
            return;
        }

        el.scrollTop += (goal - el.scrollTop) / 8 + 1;
        window.requestAnimationFrame(this.smoothScrollDown);
    };

    // Room, DM, and button click events
    readonly activateChat = async (ev: React.MouseEvent<HTMLElement>) => {
        chatInviteStore.deactivateInvite();
        const id = getAttributeInParentChain(
            ev.target as HTMLElement,
            'data-chatid'
        );
        routerStore.navigateTo(routerStore.ROUTES.chats);
        chatStore.activate(id);
    };

    readonly newMessage = () => {
        chatInviteStore.deactivateInvite();
        routerStore.navigateTo(routerStore.ROUTES.newChat);
    };

    readonly newChannel = () => {
        chatStore.deactivateCurrentChat();
        chatInviteStore.deactivateInvite();
        routerStore.navigateTo(routerStore.ROUTES.newChannel);
    };

    // Room invites click events
    @action.bound
    activateInviteByEvent(ev) {
        const kegDbId = getAttributeInParentChain(ev.target, 'data-kegdbid');
        if (!kegDbId) return;
        this.activateInvite(kegDbId);
    }

    @action.bound
    activateInvite(kegDbId) {
        chatInviteStore.activateInvite(kegDbId);
        if (chatInviteStore.activeInvite) {
            chatStore.deactivateCurrentChat();
            routerStore.navigateTo(routerStore.ROUTES.channelInvite);
        }
    }

    render() {
        return (
            <div className="feature-navigation-list messages-list">
                {/* TODO: use a general full width progress bar instead of this one. */}
                {chatStore.loading ? (
                    <ProgressBar type="linear" mode="indeterminate" />
                ) : null}
                {!chatStore.loaded ? null : (
                    <div className="list" ref={this.setScrollContainerRef}>
                        <MaintenanceWarning />
                        <List>
                            <div>
                                <PlusIcon
                                    onClick={this.newChannel}
                                    label={t('title_channels')}
                                />
                                <Tooltip
                                    text={t('title_addRoom')}
                                    position="right"
                                />
                            </div>

                            <FlipMove duration={200} easing="ease-in-out">
                                {routerStore.isNewChannel && (
                                    <ListItem
                                        key="new channel"
                                        className="room-item new-room-entry active"
                                        caption={`# ${t('title_newRoom')}`}
                                    />
                                )}
                                {this.allRoomsMap}
                            </FlipMove>
                        </List>

                        <PatientList />

                        <List clickable>
                            <div>
                                <PlusIconBeaconed
                                    beaconName="startChat"
                                    label={t('title_directMessages')}
                                    onClick={this.newMessage}
                                />
                                <Tooltip
                                    text={t('title_addDirectMessage')}
                                    position="right"
                                />
                            </div>
                            {routerStore.isNewChat && (
                                <ListItem
                                    key="new chat"
                                    className={css(
                                        'dm-item',
                                        'new-dm-list-entry',
                                        { active: routerStore.isNewChat }
                                    )}
                                    leftContent={
                                        <div className="new-dm-avatar material-icons">
                                            help_outline
                                        </div>
                                    }
                                >
                                    <i>{t('title_newDirectMessage')}</i>
                                    <Tooltip
                                        text={t('title_newDirectMessage')}
                                        position="right"
                                    />
                                </ListItem>
                            )}
                            <FlipMove duration={200} easing="ease-in-out">
                                {this.dmMap}
                            </FlipMove>
                        </List>

                        <Button
                            className={css('unread-notification top', {
                                banish: !this.prevUnread
                            })}
                            onClick={this.clickUnreadsAbove}
                        >
                            <span className="text">Unread messages</span>
                            <MaterialIcon icon="keyboard_arrow_up" />
                        </Button>
                        <Button
                            className={css('unread-notification bottom', {
                                banish: !this.nextUnread
                            })}
                            onClick={this.clickUnreadsBelow}
                        >
                            <span className="text">Unread messages</span>
                            <MaterialIcon icon="keyboard_arrow_down" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }
}
