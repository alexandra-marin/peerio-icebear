const React = require('react');
const { observer } = require('mobx-react');
const { Button, List, ListItem } = require('peer-ui');
const { contactStore } = require('peerio-icebear');
const { t } = require('peerio-translator');
const moment = require('moment');
const { getAttributeInParentChain } = require('~/helpers/dom');
const routerStore = require('~/stores/router-store');

@observer
class InvitedContacts extends React.Component {
    componentWillMount() {
        this.rerouteIfZero();
    }

    componentWillUpdate() {
        this.rerouteIfZero();
    }

    rerouteIfZero = () => {
        if (contactStore.invitedNotJoinedContacts.length) return;
        routerStore.navigateTo(routerStore.ROUTES.newInvite);
    };

    removeInvite(ev) {
        const email = getAttributeInParentChain(ev.target, 'data-id');
        contactStore.removeInvite(email);
    }
    resendInvite(ev) {
        const email = getAttributeInParentChain(ev.target, 'data-id');
        contactStore.invite(email);
    }
    contactActions(c) {
        return (
            <div data-id={c.email}>
                <Button
                    icon="email"
                    tooltip={t('button_resendInvite')}
                    tooltipPosition="bottom"
                    onClick={this.resendInvite}
                />
                <Button
                    icon="delete"
                    tooltip={t('button_delete')}
                    tooltipPosition="bottom"
                    onClick={this.removeInvite}
                />
            </div>
        );
    }

    render() {
        return (
            <div className="invited-contacts contacts-view">
                <div className="toolbar" />

                <div className="list-sort" />

                <div className="contact-list">
                    <div className="contact-list-section">
                        <div className="contact-list-section-marker" />
                        <List
                            className="contact-list-section-content"
                            theme="large"
                        >
                            {contactStore.invitedNotJoinedContacts.map(c => (
                                <ListItem
                                    key={c.email}
                                    leftContent={
                                        <div className="avatar-invited material-icons">
                                            person
                                        </div>
                                    }
                                    caption={c.email}
                                    legend={`${t('title_invited')} ${moment(
                                        c.added
                                    ).fromNow()}`}
                                    rightContent={this.contactActions(c)}
                                />
                            ))}
                        </List>
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = InvitedContacts;
