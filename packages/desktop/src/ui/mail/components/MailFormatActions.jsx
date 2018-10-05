const React = require('react');
const { observer } = require('mobx-react');
const { Button } = require('peer-ui');

@observer
class MailFormatActions extends React.Component {
    render() {
        return (
            <div className="mail-actions">
                <div className="counter">
                    <Button
                        className="attach-file"
                        icon="attach_file"
                        onClick={this.props.onFileAttach}
                    />
                    {this.props.fileCounter === 0 ? null : (
                        <div className="count">{this.props.fileCounter}</div>
                    )}
                </div>
                <div className="mail-format">
                    <Button icon="format_bold" />
                    <Button icon="format_italic" />
                    <Button icon="format_underline" />
                    <Button icon="strikethrough_s" />
                </div>
                <Button className="delete" icon="delete" />
            </div>
        );
    }
}

module.exports = MailFormatActions;
