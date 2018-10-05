// @ts-check

const React = require('react');
const { computed } = require('mobx');
const { observer } = require('mobx-react');

const css = require('classnames');
const { chatStore } = require('peerio-icebear');
const routerStore = require('~/stores/router-store');
const PatientSidebar = require('./PatientSidebar');
const PatientZeroChats = require('./PatientZeroChats');

@observer
class Patient extends React.Component {
    @computed
    get zeroState() {
        return (
            !chatStore.loading &&
            !chatStore.activeChat &&
            routerStore.currentRoute === routerStore.ROUTES.patients
        );
    }

    render() {
        return (
            <div
                className={css('messages', 'patient-space', {
                    'patient-room': chatStore.spaces.isPatientRoomOpen
                })}
            >
                <PatientSidebar />
                {this.zeroState ? <PatientZeroChats /> : null}
                {this.props.children}
            </div>
        );
    }
}

module.exports = Patient;
