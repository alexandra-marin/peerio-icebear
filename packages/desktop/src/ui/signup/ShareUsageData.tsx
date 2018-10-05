import React from 'react';
import { observer } from 'mobx-react';
import T from '~/ui/shared-components/T';
import { t } from 'peerio-translator';
import { Button } from 'peer-ui';
import * as telemetry from '~/telemetry';
import { SignupStep } from './SignupStepTypes';

@observer
export default class ShareUsageData extends React.Component<SignupStep> {
    startTime: number;

    componentDidMount() {
        this.startTime = Date.now();
    }

    componentWillUnmount() {
        telemetry.signup.durationShareData(this.startTime);
    }

    decline = () => {
        telemetry.signup.declineShareData();
        this.props.store.consentUsageData = false;
        this.props.onComplete();
    };

    accept = () => {
        telemetry.signup.acceptShareData();
        this.props.store.consentUsageData = true;
        this.props.onComplete();
    };

    render() {
        return (
            <div className="left-container">
                <div className="left-content-container">
                    <T k="title_shareUsageData" tag="div" className="heading" />
                    <T k="title_shareUsageDataDescription" tag="p" />

                    <div className="buttons-container">
                        <Button
                            onClick={this.decline}
                            label={t('button_notNow')}
                        />
                        <Button
                            onClick={this.accept}
                            theme="affirmative"
                            label={t('button_share')}
                        />
                    </div>
                </div>
            </div>
        );
    }
}
