const React = require('react');
const AppNavButton = require('./AppNavButton');
const uiStore = require('~/stores/ui-store');
const beaconStore = require('~/stores/beacon-store').default;
const Beacon = require('~/ui/shared-components/Beacon').default;
const { observer } = require('mobx-react');

@observer
class AppNavBeaconedItem extends React.Component {
    // When Beacon is directly dismissed (rather than Beacon bubble being clicked), cancel remaining onboarding beacons
    cancelOnboardingBeacons() {
        if (uiStore.firstLogin) {
            beaconStore.markAsRead(['chat', 'files', 'contact']);
        }
    }

    onNavigateClick = () => {
        beaconStore.clearBeacons();
        this.cancelOnboardingBeacons();
        this.props.onClick();
    };

    render() {
        const beaconButton = <AppNavButton {...this.props} />;
        // override navigate onclick so that we can hide the beacons
        const navigateButton = (
            <AppNavButton {...this.props} onClick={this.onNavigateClick} />
        );

        return (
            <Beacon
                type="spot"
                name={this.props.beaconName}
                size={48}
                offsetY={12}
                className="appnav-beacon"
                circleContent={beaconButton}
                onContentClick={this.props.onClick}
                onBeaconClick={this.cancelOnboardingBeacons}
            >
                {navigateButton}
            </Beacon>
        );
    }
}

module.exports = AppNavBeaconedItem;
