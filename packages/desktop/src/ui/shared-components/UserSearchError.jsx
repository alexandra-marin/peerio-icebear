const React = require('react');
const { observer } = require('mobx-react');

const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');
const { Button, MaterialIcon } = require('peer-ui');

@observer
class UserSearchError extends React.Component {
    invite = () => {
        this.props.onInvite();
    };

    render() {
        return (
            <div className="user-search-error">
                <div className="search-error-text">
                    <MaterialIcon icon="help_outline" />
                    {this.props.userAlreadyAdded ? (
                        <T k="error_userAlreadyAdded" tag="div">
                            {{ user: this.props.userAlreadyAdded }}
                        </T>
                    ) : null}
                    {this.props.userNotFound ? (
                        <T k="error_userNotFoundTryEmail" tag="div">
                            {{ user: this.props.userNotFound }}
                        </T>
                    ) : null}
                    {this.props.suggestInviteEmail ? (
                        <T k="title_inviteContactByEmail">
                            {{ email: this.props.suggestInviteEmail }}
                        </T>
                    ) : null}
                </div>
                {this.props.suggestInviteEmail ? (
                    <Button onClick={this.invite} label={t('button_invite')} />
                ) : null}
            </div>
        );
    }
}

module.exports = UserSearchError;
