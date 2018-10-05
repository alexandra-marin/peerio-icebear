const React = require('react');
const PlusIcon = require('~/ui/shared-components/PlusIcon');
const Beacon = require('~/ui/shared-components/Beacon').default;
const { observer } = require('mobx-react');

@observer
class PlusIconBeaconed extends React.Component {
    render() {
        const beaconButton = <PlusIcon {...this.props} label={null} />;
        const actionButton = <PlusIcon {...this.props} />;

        return (
            <Beacon
                name={this.props.beaconName}
                type="spot"
                size={48}
                offsetX={100}
                circleContent={beaconButton}
                className="chatlist-plusicon-beacon"
            >
                {actionButton}
            </Beacon>
        );
    }
}

module.exports = PlusIconBeaconed;
