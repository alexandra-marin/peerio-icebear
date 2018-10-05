const React = require('react');
const { Button, Chip, Divider, Menu, MenuItem } = require('peer-ui');
const { User, socket } = require('peerio-icebear');
const { observable } = require('mobx');
const { observer } = require('mobx-react');

@observer
class DevTools extends React.Component {
    @observable menuActive = false;
    toggleMenu = () => {
        this.menuActive = !this.menuActive;
    };
    hideMenu = () => {
        this.menuActive = false;
    };
    quit() {
        if (User.current) {
            window.router.push('/app/chats');
        } else {
            window.router.push('/');
        }
    }
    gotoDashboard() {
        window.router.push('/dev-tools');
    }
    gotoKegEditor() {
        window.router.push('/dev-tools/kegs');
    }

    render() {
        return (
            <div className="dev-tools-root">
                <link
                    key="dev_tools_style"
                    rel="stylesheet"
                    href="./dev-tools-style.css"
                />
                <div className="top-bar">
                    <Menu icon="menu" className="menu" position="top-left">
                        <MenuItem
                            icon="dashboard"
                            caption="Dashboard"
                            onClick={this.gotoDashboard}
                        />
                        <MenuItem
                            icon="grid_on"
                            caption="Keg Editor"
                            onClick={this.gotoKegEditor}
                        />
                        <Divider />
                        <MenuItem
                            icon="close"
                            caption="Close"
                            onClick={this.quit}
                        />
                    </Menu>
                    <div className="separator" />
                    {socket.connected ? (
                        <Chip className="good-bg">connected</Chip>
                    ) : (
                        <Chip className="bad-bg">disconnected</Chip>
                    )}
                    {socket.authenticated ? (
                        <Chip className="good-bg">authenticated</Chip>
                    ) : (
                        <Chip className="bad-bg">not authenticated</Chip>
                    )}
                    <div className="separator" />
                    <Button icon="close" onClick={this.quit} />
                </div>
                {this.props.children}
            </div>
        );
    }
}

module.exports = DevTools;
