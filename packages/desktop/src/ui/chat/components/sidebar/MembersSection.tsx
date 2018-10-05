import React from 'react';
import { action, observable } from 'mobx';
import { observer } from 'mobx-react';
import css from 'classnames';

import { chatStore, contactStore, chatInviteStore, User } from 'peerio-icebear';
import { Avatar, List, ListHeading, ListItem, Menu, MenuItem } from 'peer-ui';
import { t } from 'peerio-translator';

import T from '~/ui/shared-components/T';
import ContactProfile from '~/ui/contact/components/ContactProfile';
import ELEMENTS from '~/whitelabel/helpers/elements';
import { getAttributeInParentChain } from '~/helpers/dom';
import SideBarSection from './SideBarSection';

// ///////
// FIXME: use icebear Contact type
import { ContactProps } from 'peer-ui/dist/components/helpers/interfaces';
type Contact_TEMP = ContactProps & { fullName: string }; // eslint-disable-line camelcase
type Chat_TEMP = { isAdmin(contact: Contact_TEMP): boolean }; // eslint-disable-line camelcase
// ///////

interface MembersSectionProps {
    open: boolean;
    onToggle: () => void;
    onAddParticipants: () => void;
}

@observer
export default class MembersSection extends React.Component<
    MembersSectionProps
> {
    contactProfileRef = React.createRef<ContactProfile>();

    @observable clickedContact;

    @action.bound
    openContact(ev: React.MouseEvent) {
        this.clickedContact = contactStore.getContact(
            ev.currentTarget.attributes['data-username'].value
        );
        this.contactProfileRef.current!.openDialog();
    }

    // FIXME: stop stashing data in the DOM! just make a separate component
    deleteInvite(ev: React.MouseEvent) {
        ev.stopPropagation();
        const username = getAttributeInParentChain(ev.target, 'data-username');
        chatInviteStore.revokeInvite(chatStore.activeChat.id, username);
    }

    deleteParticipant(ev: React.MouseEvent) {
        ev.stopPropagation();
        const username = getAttributeInParentChain(ev.target, 'data-username');
        chatStore.activeChat.removeParticipant(username);
    }

    makeAdmin(ev: React.MouseEvent) {
        ev.stopPropagation();
        const username = getAttributeInParentChain(ev.target, 'data-username');
        chatStore.activeChat.promoteToAdmin(contactStore.getContact(username));
    }

    demoteAdmin(ev: React.MouseEvent) {
        ev.stopPropagation();
        const username = getAttributeInParentChain(ev.target, 'data-username');
        chatStore.activeChat.demoteAdmin(contactStore.getContact(username));
    }

    stopPropagation(ev: React.MouseEvent) {
        ev.stopPropagation();
    }

    userMenu(username: string) {
        const menuItems = [];

        ELEMENTS.membersSection.userMenuItems(username).forEach(item => {
            menuItems.push(
                <MenuItem
                    key={item.key}
                    value={item.value}
                    icon={item.icon}
                    caption={t(item.caption)}
                    onClick={this[item.onClick]}
                />
            );
        });

        return (
            <Menu
                icon="more_vert"
                position="bottom-right"
                onClick={this.stopPropagation}
                data-username={username}
            >
                {menuItems}
            </Menu>
        );
    }

    adminMenu(username: string) {
        // FIXME: make a separate component, don't try to stash data in the dom
        return (
            <Menu
                icon="more_vert"
                position="bottom-right"
                onClick={this.stopPropagation}
                data-username={username}
            >
                <MenuItem
                    value="demote_admin"
                    icon="highlight_off"
                    caption={t('button_demoteAdmin')}
                    onClick={this.demoteAdmin}
                />
                <MenuItem
                    value="delete"
                    icon="remove_circle_outline"
                    caption={t('button_remove')}
                    onClick={this.deleteParticipant}
                />
            </Menu>
        );
    }

    inviteMenu(username: string) {
        return (
            <Menu
                icon="more_vert"
                position="bottom-right"
                onClick={this.stopPropagation}
                data-username={username}
            >
                <MenuItem
                    icon="remove_circle_outline"
                    caption={t('button_remove')}
                    onClick={this.deleteInvite}
                />
            </Menu>
        );
    }

    renderJoinedParticipant = (
        c: Contact_TEMP,
        chat: Chat_TEMP,
        showAdmin: boolean
    ) => {
        return (
            <ListItem
                data-username={c.username}
                key={c.username}
                leftContent={
                    <Avatar key="a" contact={c} size="small" clickable />
                }
                caption={
                    <div className="user-caption">
                        <span className="username">{c.username}</span>
                        {chat.isAdmin(c) ? (
                            <T k="title_admin" className="tag" />
                        ) : null}
                    </div>
                }
                legend={c.fullName}
                rightContent={
                    showAdmin && User.current.username !== c.username
                        ? chat.isAdmin(c)
                            ? this.adminMenu(c.username)
                            : this.userMenu(c.username)
                        : null
                }
                onClick={this.openContact}
            />
        );
    };

    renderInvitedParticipant = (c: Contact_TEMP, showAdmin: boolean) => {
        return (
            <ListItem
                data-username={c.username}
                key={`invited--${c.username}`}
                caption={c.username}
                rightContent={showAdmin && this.inviteMenu(c.username)}
                onClick={this.openContact}
            />
        );
    };

    render() {
        const chat = chatStore.activeChat;
        if (!chat) return null;
        const invited = chatInviteStore.sent.get(chat.id);
        const { isChannel, canIAdmin } = chat;
        const showAdmin = isChannel && canIAdmin;

        if (!isChannel && !chat.otherParticipants.length) {
            // this removes member section from DM chat with self
            return null;
        }

        return (
            <SideBarSection
                title={t('title_Members')}
                onToggle={this.props.onToggle}
                open={this.props.open}
            >
                <div
                    className={css('member-list', 'scrollable', {
                        'with-admin-controls': isChannel && canIAdmin
                    })}
                >
                    {isChannel && canIAdmin ? (
                        <List className="action-list" clickable>
                            <ListItem
                                className="admin-controls"
                                leftIcon="person_add"
                                caption={t('button_inviteToChannel')}
                                onClick={this.props.onAddParticipants}
                            />
                        </List>
                    ) : null}
                    <List clickable>
                        {chat.allJoinedParticipants.map(c =>
                            this.renderJoinedParticipant(c, chat, showAdmin)
                        )}
                        {invited && invited.length ? (
                            <ListHeading caption={t('title_invited')} />
                        ) : null}
                        {invited
                            ? invited.map(c =>
                                  this.renderInvitedParticipant(c, showAdmin)
                              )
                            : null}
                    </List>
                </div>
                <ContactProfile
                    ref={this.contactProfileRef}
                    contact={this.clickedContact}
                />
            </SideBarSection>
        );
    }
}
