import { observer } from 'mobx-react';
import React from 'react';
import T from '~/ui/shared-components/T';
import { MaterialIcon } from 'peer-ui';
import css from 'classnames';

@observer
export default class IdentityVerificationNotice extends React.Component<{
    extraMargin?: boolean;
}> {
    render() {
        return (
            <div className="identity-verification-notice">
                <div
                    className={css('notice-container', {
                        'extra-margin': this.props.extraMargin
                    })}
                >
                    <MaterialIcon className="notice-icon" icon="security" />
                    <T className="text-content" k="title_verifyUserIdentity" />
                </div>
            </div>
        );
    }
}
