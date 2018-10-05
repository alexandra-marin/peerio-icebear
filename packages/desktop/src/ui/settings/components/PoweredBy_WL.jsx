const React = require('react');

// @observer
class PoweredBy extends React.Component {
    render() {
        return (
            <img
                className="poweredBy"
                alt="Powered by Peerio"
                src="static/img/poweredByPeerio_colour.png"
            />
        );
    }
}

module.exports = PoweredBy;
