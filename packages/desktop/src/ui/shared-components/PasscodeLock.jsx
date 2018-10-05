const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { Input } = require('peer-ui');
const { t } = require('peerio-translator');
const { User } = require('peerio-icebear');
const _ = require('lodash');

@observer
class PasscodeLock extends React.Component {
    @observable passcode = '';
    @observable error;

    handleChange = val => {
        this.passcode = val;
        this.validatePasscode();
    };

    unlock = () => {
        this.props.onUnlocked();
        this.error = null;
    };

    handleError = () => {
        this.error = t('error_wrongPassword');
    };

    onInputMount(ref) {
        if (ref) ref.focus();
    }
    validatePasscode = _.debounce(() => {
        User.current
            .validatePasscode(this.passcode)
            .then(this.unlock)
            .catch(this.handleError);
    }, 350);

    render() {
        return (
            <div className="passcode-lock">
                <p>{t('title_enterPasswordDetail')}</p>
                <Input
                    type="password"
                    value={this.passcode}
                    label={t('title_devicePassword')}
                    onChange={this.handleChange}
                    error={this.error}
                    innerRef={this.onInputMount}
                />
            </div>
        );
    }
}

module.exports = PasscodeLock;
