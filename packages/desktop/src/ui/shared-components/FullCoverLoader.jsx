const React = require('react');
const { ProgressBar } = require('peer-ui');

function FullCoverLoader(props) {
    return props.show ? (
        <div className="progress-overlay" style={props.style}>
            <ProgressBar mode="indeterminate" />
        </div>
    ) : null;
}

module.exports = FullCoverLoader;
