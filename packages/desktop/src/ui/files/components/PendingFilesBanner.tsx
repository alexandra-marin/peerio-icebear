import React from 'react';
import uiStore from '~/stores/ui-store';
import { MaterialIcon, Button } from 'peer-ui';
import { t } from 'peerio-translator';
import config from '~/config';

export default function PendingFilesBanner() {
    return (
        <div className="pending-files-banner">
            <div className="banner-icon">
                <MaterialIcon icon="info" />
            </div>
            <div className="banner-note">
                {/* No sense in localizing the text below for this very temporary banner */}
                <div className="title">
                    Files marked "pending" will be removed by November 15th
                    2018.
                </div>
                <div className="subtitle">
                    Encourage the owners of these files to sign into Peerio to
                    migrate, or download and re-upload these files to keep a
                    copy.
                </div>
            </div>
            <div className="banner-buttons">
                <Button
                    label={t('button_dismiss')}
                    onClick={uiStore.hidePendingFilesBanner}
                    theme="inverted"
                />
                <Button
                    label={t('button_learnMore')}
                    href={config.translator.urlMap.pendingFiles}
                    theme="affirmative primary"
                    style={{
                        backgroundColor: 'transparent',
                        border: '1px solid'
                    }}
                />
            </div>
        </div>
    );
}
