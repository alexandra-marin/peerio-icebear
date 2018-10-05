const React = require('react');
const { observer } = require('mobx-react');
const { chatStore } = require('peerio-icebear');

const T = require('~/ui/shared-components/T');
const PlusIcon = require('~/ui/shared-components/PlusIcon');

@observer
class PatientZeroChats extends React.Component {
    render() {
        return (
            <div className="patient-zero-chats">
                <div className="patient-name-header">
                    <T k="mcr_title_patient" />:{' '}
                    {chatStore.spaces.currentSpaceName}
                </div>
                <div className="content">
                    <section>
                        <T k="mcr_title_internalRooms" className="title" />
                        <T
                            k="mcr_title_internalRoomsDescription1"
                            className="headline"
                        />
                        <T
                            k="mcr_title_internalRoomsDescription2"
                            className="description"
                        >
                            {{ plusIcon: () => <PlusIcon /> }}
                        </T>
                        <T
                            k="mcr_title_internalRoomsDescription3"
                            className="description"
                        />
                    </section>
                    <section>
                        <T k="mcr_title_patientRooms" className="title" />
                        <T
                            k="mcr_title_patientRoomsDescription1"
                            className="headline"
                        />
                        <T
                            k="mcr_title_patientRoomsDescription2"
                            className="description"
                        />
                        <T
                            k="mcr_title_patientRoomsDescription3"
                            className="description"
                        />
                    </section>
                    <img src="" />
                </div>
            </div>
        );
    }
}

module.exports = PatientZeroChats;
