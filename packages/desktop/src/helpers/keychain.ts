// We import the keytar module here for typechecking but don't use it yet; this
// statement should be removed by the compiler. (We could more simply use the
// `let keytar = typeof import('keytar')` syntax, but @babel/plugin-transform-typescript
// doesn't support it yet; see https://github.com/babel/babel/issues/7749.)
import Keytar from 'keytar';

import cfg from '~/config';

/**
 * Keytar is a native module and we suspect it might not always work as expected.
 * Keytar malfunction is not blocking user from using the app so we'll try to handle errors gracefully.
 * The purpose of this module is to wrap keytar API into more suitable to us manner.
 */
let keytar: typeof Keytar;
try {
    keytar = require('keytar');
} catch (err) {
    console.error('Keytar error', err);
}

const service = cfg.keychainService;

export async function saveSecret(
    username: string,
    passphrase: string
): Promise<boolean> {
    if (!keytar) return false;
    try {
        await keytar.setPassword(service, username, passphrase);
        return true;
    } catch (err) {
        console.error('Error setting passphrase with keytar', err);
        return false;
    }
}

export async function getSecret(username: string): Promise<string | false> {
    if (!keytar) return false;
    try {
        const ret = await keytar.getPassword(service, username);
        return ret || false;
    } catch (err) {
        console.error('Error getting passphrase with keytar', err);
        return false;
    }
}

export async function removeSecret(username: string): Promise<boolean> {
    if (!keytar) return false;
    try {
        await keytar.deletePassword(service, username);
        return true;
    } catch (err) {
        console.error('Error deleting passphrase with keytar', err);
        return false;
    }
}
