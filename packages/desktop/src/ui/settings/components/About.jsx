const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { Button } = require('peer-ui');
const { t } = require('peerio-translator');
const version = require('electron').remote.app.getVersion();
const { socket } = require('peerio-icebear');

const Copyright = require('~/whitelabel/components/Copyright');
const PoweredBySettings = require('~/whitelabel/components/PoweredBySettings');
const LegalDialog = require('~/ui/shared-components/LegalDialog').default;

@observer
class About extends React.Component {
    @observable termsDialogOpen = false;
    @observable legalDialogRef = React.createRef();

    showTermsDialog = () => {
        this.legalDialogRef.current.showDialog();
    };

    render() {
        return (
            <div>
                <section className="section-divider">
                    <img className="logo" src="static/img/logo-withtext.svg" />
                    <PoweredBySettings />
                    <p>
                        {t('title_version')} <strong>{version}</strong>
                    </p>
                    <p>
                        {t('title_networkLatency')}{' '}
                        <strong>{socket.latency}ms</strong>
                    </p>
                </section>
                <section>
                    <Copyright />
                    <div className="settings-terms">
                        {t('title_appName')}
                        <Button
                            onClick={this.showTermsDialog}
                            label={t('button_terms')}
                            theme="link"
                        />
                    </div>
                </section>

                <LegalDialog content="terms" ref={this.legalDialogRef} />
            </div>
        );
    }
}

module.exports = About;
