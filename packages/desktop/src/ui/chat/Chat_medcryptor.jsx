// @ts-check

const React = require('react');
const { observer } = require('mobx-react');
const ChatList = require('./components/ChatList').default;

@observer
class Chat extends React.Component {
    render() {
        return (
            <div className="messages">
                <ChatList />
                {this.props.children}
            </div>
        );
    }
}

module.exports = Chat;
