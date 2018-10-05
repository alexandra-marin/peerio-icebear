const React = require('react');
const { computed } = require('mobx');
const { observer } = require('mobx-react');

const { t } = require('peerio-translator');
const { chatStore, chatInviteStore } = require('peerio-icebear');
const routerStore = require('~/stores/router-store');

const css = require('classnames');
const FlipMove = require('react-flip-move');
const { List, ListItem, Tooltip } = require('peer-ui');
const PlusIcon = require('~/ui/shared-components/PlusIcon');
const { getAttributeInParentChain } = require('~/helpers/dom');
const T = require('~/ui/shared-components/T');

@observer
class PatientList extends React.Component {
    newPatient = () => {
        chatStore.deactivateCurrentChat();
        chatInviteStore.deactivateInvite();
        routerStore.navigateTo(routerStore.ROUTES.newPatient);
    };

    activatePatient = ev => {
        chatStore.deactivateCurrentChat();
        chatInviteStore.deactivateInvite();

        const spaceId = getAttributeInParentChain(ev.target, 'data-chatid');
        chatStore.spaces.activeSpaceId = spaceId;
        routerStore.navigateTo(routerStore.ROUTES.patients);
    };

    // Buildling patient list
    // TODO: this will throw off `this.unreadPositions`!
    @computed
    get patientsMap() {
        return chatStore.spaces.spacesList.map(space => {
            let rightContent = null;
            if (space.isNew) {
                rightContent = <T k="title_new" className="badge-new" />;
            } else if (space.unreadCount > 0) {
                rightContent = (
                    <div className="notification">
                        {space.unreadCount < 100 ? space.unreadCount : '99+'}
                    </div>
                );
            }
            return (
                <ListItem
                    data-chatid={space.spaceId}
                    className={css('room-item', 'patient-item')}
                    onClick={this.activatePatient}
                    caption={space.spaceName}
                    key={space.spaceName}
                    rightContent={rightContent}
                />
            );
        });
    }

    render() {
        return (
            <List>
                <div>
                    <PlusIcon
                        onClick={this.newPatient}
                        label={t('mcr_title_patientFiles')}
                    />
                    <Tooltip
                        text={t('mcr_button_addPatient')}
                        position="right"
                    />
                </div>
                <FlipMove duration={200} easing="ease-in-out">
                    {routerStore.isNewPatient && (
                        <ListItem
                            key="new patient"
                            className="room-item new-room-entry active"
                            caption={`# ${t('mcr_title_newPatient')}`}
                        />
                    )}
                    {this.patientsMap}
                </FlipMove>
            </List>
        );
    }
}

module.exports = PatientList;
