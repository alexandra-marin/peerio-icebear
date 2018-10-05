import { requestDownloadPath } from '~/helpers/file';
import { saveAccountKeyBackup } from 'peerio-icebear';
import { t } from 'peerio-translator';
import * as telemetry from '~/telemetry';

export async function saveAkPdf(store) {
    const { username, firstName, lastName, passphrase } = store;
    let path = '';
    try {
        path = await requestDownloadPath(
            `${username}-${t('title_appName')}.pdf`
        );
        telemetry.signup.confirmDownloadAk();
    } catch (err) {
        // user cancel
    }

    if (path) {
        saveAccountKeyBackup(
            path,
            `${firstName} ${lastName}`,
            username,
            passphrase
        );
    }
}
