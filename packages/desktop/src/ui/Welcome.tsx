import React from 'react';
import { observer } from 'mobx-react';
import T from '~/ui/shared-components/T';
import beaconStore from '~/stores/beacon-store';

@observer
export default class Welcome extends React.Component {
    componentWillMount() {
        beaconStore.queueFirstBeacon('contact', 2000);
    }

    componentWillUnmount() {
        beaconStore.clearQueuedBeacons();
    }

    render() {
        return (
            <div className="welcome">
                <T k="title_zeroFirstLoginTitleDesktop" className="headline" />
                <T k="title_zeroFirstLoginMessage" className="subtitle" />
                <T k="title_learnFollowWalkthrough" className="small-print" />
            </div>
        );
    }
}
