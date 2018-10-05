const React = require('react');
const { observer } = require('mobx-react');
const { Switch } = require('peer-ui');
const uiStore = require('~/stores/ui-store');

@observer
class Dev extends React.Component {
    onPrereleaseChange(ev) {
        uiStore.sharedPrefs.prereleaseUpdatesEnabled = ev.target.checked;
    }

    render() {
        return (
            <div>
                <section>
                    <Switch
                        checked={uiStore.sharedPrefs.prereleaseUpdatesEnabled}
                        label="Enable pre-release updates (requires app restart)"
                        onChange={this.onPrereleaseChange}
                    />
                </section>
            </div>
        );
    }
}

module.exports = Dev;
