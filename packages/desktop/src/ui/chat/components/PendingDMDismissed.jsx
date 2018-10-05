const React = require('react');
const { computed } = require('mobx');
const { observer } = require('mobx-react');

const { chatStore, chatInviteStore } = require('peerio-icebear');
const routerStore = require('~/stores/router-store');
const T = require('~/ui/shared-components/T');

const { Button } = require('peer-ui');
const EmojiImage = require('~/ui/emoji/Image');
const PlusIcon = require('~/ui/shared-components/PlusIcon');

@observer
class PendingDMDismissed extends React.Component {
    @computed
    get chatListEmpty() {
        // TODO: refactor when SDK is there for chat invites
        return !chatStore.chats.length && !chatInviteStore.received.length;
    }

    onCancel = () => {
        routerStore.navigateTo(routerStore.ROUTES.chats);
    };

    render() {
        return (
            <div className="pending-dm dismissed">
                <EmojiImage emoji="relieved" size="large" />
                <T className="main-text" k="title_acceptedInvitationDismissed">
                    {{ plusIcon: () => <PlusIcon /> }}
                </T>

                {this.chatListEmpty && (
                    <div className="button-container">
                        <Button onClick={this.onCancel}>
                            <T k="button_dismiss" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }
}

module.exports = PendingDMDismissed;
