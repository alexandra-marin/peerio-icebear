const React = require('react');
const { t } = require('peerio-translator');
const { List, ListItem, Tooltip } = require('peer-ui');
const PlusIcon = require('~/ui/shared-components/PlusIcon');
const { action } = require('mobx');
const { observer } = require('mobx-react');
const routerStore = require('~/stores/router-store');
const { contactStore } = require('peerio-icebear');
const css = require('classnames');

@observer
class Contacts extends React.Component {
    @action
    toAddNew() {
        routerStore.navigateTo(routerStore.ROUTES.newContact);
    }

    @action
    toAdded() {
        contactStore.uiViewFilter = 'added';
        routerStore.navigateTo(routerStore.ROUTES.contacts);
    }
    @action
    toInvited() {
        routerStore.navigateTo(routerStore.ROUTES.invitedContacts);
    }

    @action
    toAll() {
        contactStore.uiViewFilter = 'all';
        routerStore.navigateTo(routerStore.ROUTES.contacts);
    }

    render() {
        const isAddedActive =
            routerStore.currentRoute === routerStore.ROUTES.contacts &&
            contactStore.uiViewFilter === 'added';
        const isAllActive =
            routerStore.currentRoute === routerStore.ROUTES.contacts &&
            contactStore.uiViewFilter === 'all';
        const isInvitedActive =
            routerStore.currentRoute === routerStore.ROUTES.invitedContacts;
        return (
            <div className="contacts">
                <div className="feature-navigation-list">
                    <div className="list">
                        <List clickable>
                            <div>
                                <PlusIcon
                                    onClick={this.toAddNew}
                                    label={t('title_contacts')}
                                />
                                <Tooltip
                                    text={t('button_addAContact')}
                                    position="right"
                                />
                            </div>
                            <ListItem
                                leftIcon="star"
                                caption={`${t('title_favoriteContacts')} (${
                                    contactStore.addedContacts.length
                                })`}
                                className={css({ active: isAddedActive })}
                                onClick={this.toAdded}
                            />
                            <ListItem
                                leftIcon="people"
                                caption={`${t('title_allContacts')} (${
                                    contactStore.contacts.length
                                })`}
                                className={css({ active: isAllActive })}
                                onClick={this.toAll}
                            />
                            <ListItem
                                leftIcon="person_add"
                                caption={`${t('title_invitedContacts')} (${
                                    contactStore.invitedNotJoinedContacts.length
                                })`}
                                className={css({ active: isInvitedActive })}
                                onClick={this.toInvited}
                            />
                        </List>
                    </div>
                </div>
                {this.props.children}
            </div>
        );
    }
}

module.exports = Contacts;
