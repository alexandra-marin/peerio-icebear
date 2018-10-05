const React = require('react');
const { Button } = require('peer-ui');
const css = require('classnames');
const { observer } = require('mobx-react');

@observer
class AppNav extends React.Component {
    render() {
        return (
            <div
                className={css('menu-item', { active: this.props.active })}
                onClick={this.props.onClick}
            >
                <Button
                    tooltip={this.props.tooltip}
                    tooltipPosition="right"
                    icon={this.props.icon}
                />
                <div
                    className={this.props.showBadge ? 'look-at-me' : 'banish'}
                />
            </div>
        );
    }
}

module.exports = AppNav;
