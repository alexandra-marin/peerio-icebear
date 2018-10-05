const React = require('react');
const { observer } = require('mobx-react');

@observer
class Copyright extends React.Component {
    render() {
        return (
            <span>
                &copy; 2017 Peerio Technologies, Inc. All rights reserved.
            </span>
        );
    }
}

module.exports = Copyright;
