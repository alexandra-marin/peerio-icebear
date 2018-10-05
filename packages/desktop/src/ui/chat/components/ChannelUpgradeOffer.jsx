const React = require('react');
const { observer } = require('mobx-react');
const { Button } = require('peer-ui');
const { t } = require('peerio-translator');
const { User } = require('peerio-icebear');
const config = require('~/config');
const T = require('~/ui/shared-components/T');
const urls = require('~/config').translator.urlMap;

@observer
class ChannelUpgradeOffer extends React.Component {
    toUpgrade() {
        return window.open(urls.upgrade);
    }

    render() {
        if (config.disablePayments) return null;
        if (User.current.channelsLeft > 0) return null;
        return (
            <div className="upgrade-rooms">
                <div>
                    <span>👋 </span>
                    <T k="title_channelUpgradeOffer">
                        {{ limit: User.current.channelLimit }}
                    </T>
                </div>
                <Button onClick={this.toUpgrade} label={t('button_upgrade')} />
            </div>
        );
    }
}

module.exports = ChannelUpgradeOffer;
