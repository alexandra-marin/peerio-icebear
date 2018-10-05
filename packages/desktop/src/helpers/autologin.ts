import { User, warnings, crypto, TinyDb } from 'peerio-icebear';
import * as keychain from '~/helpers/keychain';

export function enable(): void {
    return _setAutologin(true);
}

export function disable(): void {
    return _setAutologin(false);
}

function _setAutologin(enabled: boolean): void {
    User.current.autologinEnabled = enabled;
    if (enabled) {
        keychain
            .saveSecret(
                User.current.username,
                crypto.cryptoUtil.padPassphrase(User.current.passphrase)
            )
            .then(ret => {
                if (!ret) {
                    console.error(
                        'Failed to set autologin (libary returned false).'
                    );
                    warnings.addSevere('title_autologinSetFail');
                }
                User.current.autologinEnabled = true;
            })
            .catch(() => {
                User.current.autologinEnabled = false;
                warnings.addSevere('title_autologinSetFail');
            });
    } else {
        keychain
            .removeSecret(User.current.username)
            .then(() => {
                User.current.autologinEnabled = false;
            })
            .catch(() => {
                User.current.autologinEnabled = true;
                warnings.addSevere('title_autologinDisableFail');
            });
    }
}

export function getPassphrase(username: string): Promise<string | false> {
    return keychain.getSecret(username).then(padded => {
        if (padded) return crypto.cryptoUtil.unpadPassphrase(padded);
        return false;
    });
}

/**
 * Marks current user on current device as 'should not be suggested to enablie autologin'
 */
export function dontSuggestEnablingAgain() {
    return TinyDb.user.setValue('autologinSuggested', true);
}

export async function shouldSuggestEnabling() {
    const ret = await TinyDb.user.getValue('autologinSuggested');
    return !ret;
}
