const React = require('react');
const { when } = require('mobx');
const { observer } = require('mobx-react');
const { chatStore, chatInviteStore, crypto } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');
const { ProgressBar } = require('peer-ui');
const routerStore = require('~/stores/router-store');
const ELEMENTS = require('~/whitelabel/helpers/elements');

const messages = [
    'title_randomMessage1',
    'title_randomMessage2',
    'title_randomMessage3',
    'title_randomMessage4'
];
const randomMessage =
    messages[crypto.cryptoUtil.getRandomNumber(0, messages.length - 1)];

@observer
class Loading extends React.Component {
    componentDidMount() {
        this.dispose = when(
            () => chatStore.loaded,
            () => {
                // TODO: refactor when SDK is there for chat invites
                if (chatStore.chats.length || chatInviteStore.received.length) {
                    ELEMENTS.loading.goToActiveChat();
                } else {
                    routerStore.navigateTo(routerStore.ROUTES.chats);
                }
                this.dispose = null;
            }
        );
    }

    componentWillUnmount() {
        if (this.dispose) this.dispose();
    }

    render() {
        return (
            <div className="loading-screen">
                <ProgressBar type="linear" mode="indeterminate" />
                <div className="random-messages">
                    <T k={randomMessage} className="headline" tag="div" />
                </div>
            </div>
        );
    }
}

module.exports = Loading;
