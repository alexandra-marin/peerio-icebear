const React = require('react');
// const { Menu, MenuItem } = require('peer-ui');
const { observer } = require('mobx-react');
const css = require('classnames');
const { ghostStore } = require('peerio-icebear');

@observer
class MailItem extends React.Component {
    handleSelect = () => {
        ghostStore.selectedId = this.props.ghostId;
    };

    render() {
        return (
            <div
                className={css('mail-item', {
                    active: ghostStore.selectedId === this.props.ghostId,
                    draft: !this.props.sent,
                    alive: this.props.alive,
                    attachments: this.props.attachments
                })}
                onClick={this.handleSelect}
            >
                <div className="mail-item-content">
                    <div className="subject-container">
                        <strong className="item-subject">
                            {this.props.subject}
                        </strong>
                        {this.props.date}
                    </div>
                    <div>{this.props.recipient}</div>
                    <div className="firstline-container">
                        <div className="item-firstline">
                            {this.props.firstLine}
                        </div>
                    </div>
                </div>
                {/* <Menu icon="more_vert" className="flex-shrink-0">
                    <MenuItem icon="markunread_mailbox" caption="Mark unread" />
                    <MenuItem icon="thumb_down" caption="Mark junk" />
                    <MenuItem icon="block" caption="Block sender" />
                    <MenuItem icon="delete" caption="Delete" />
                </Menu> */}
            </div>
        );
    }
}

module.exports = MailItem;
