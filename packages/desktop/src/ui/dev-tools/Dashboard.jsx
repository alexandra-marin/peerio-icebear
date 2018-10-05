const React = require('react');
const { Button, Input } = require('peer-ui');
const { User, socket } = require('peerio-icebear');
const config = require('~/config');
const { observable } = require('mobx');
const { observer } = require('mobx-react');

class DevToolsDashboard extends React.Component {
    render() {
        return (
            <div className="dashboard selectable">
                <div className="card">
                    <div className="headline">Socket server</div>
                    <ChangeServer />
                </div>
                <div className="card width-1_3">
                    <div className="headline">Current user</div>
                    <UserDetails />
                </div>
                <div className="card width-2_3">
                    <div className="headline">Config</div>
                    <pre className="selectable">
                        {JSON.stringify(config, null, 2)}
                    </pre>
                </div>
            </div>
        );
    }
}

function UserDetails() {
    if (!User.current) {
        return <span>Not authenticated.</span>;
    }
    return (
        <span className="selectable">
            Username: <strong>{User.current.username}</strong>
            <br />
            First name: <strong>{User.current.firstName}</strong>
            <br />
            Last name: <strong>{User.current.lastName}</strong>
        </span>
    );
}

@observer
class ChangeServer extends React.Component {
    @observable server;
    onServerChange = v => {
        this.server = v;
    };
    changeServer = () => {
        socket.close();
        socket.socket.io.uri = this.server;
        socket.open();
        this.forceUpdate();
    };
    render() {
        if (User.current) {
            return (
                <span>Can't change server after login, sign out first.</span>
            );
        }

        return (
            <span className="selectable">
                Current server: {socket.socket.io.uri}
                <Input
                    type="text"
                    value={this.server}
                    onChange={this.onServerChange}
                    label="Server url"
                />
                <br />
                <Button
                    label="Change and reconnect"
                    onClick={this.changeServer}
                />
            </span>
        );
    }
}

module.exports = DevToolsDashboard;
