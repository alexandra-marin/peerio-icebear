/*
 * Icebear client lib entry point.
 * In addition to exporting public API, entry point, when first required,
 * performs some global configuration such as:
 * - replaces global Promise object with bluebird implementation. Note that native(not transpiled) async functions
 *  will still return native Promise.
 * - extends Uint8Array prototype.
 */

import './helpers/performance-polyfill';

// replacing native Promise with bluebird implementation
import Bluebird from 'bluebird';
import globalContext from './helpers/global-context';

globalContext.Promise = Bluebird;

// @ts-ignore
Bluebird.coroutine.addYieldHandler(function(value) {
    return Bluebird.resolve(value);
});

// Enables all warnings except forgotten return statements.
Bluebird.config({ warnings: { wForgottenReturn: false } });

// extending native classes
import './extensions/uint8array';

// MEMO: Do NOT export NodeJsonStorage and NodeFileStream here for compatibility reasons
/*
export default {
    errors,
    crypto,
    util,
    fileHelpers,
    prombservable,
};
*/
// exporting Icebear Library Interface
export { default as socket } from './network/socket';
export { default as User } from './models/user/user';
export { default as PhraseDictionary } from './models/phrase-dictionary';
export { default as config, Config } from './config';
export { default as contactStore } from './models/contacts/contact-store';
export { default as tofuStore } from './models/contacts/tofu-store';
export { default as chatStore } from './models/chats/chat-store';
export { default as fileStore } from './models/files/file-store';
export { default as volumeStore } from './models/volumes/volume-store';
export { default as FileStreamBase } from './models/files/file-stream-base';
export { default as FileNonceGenerator } from './models/files/file-nonce-generator';
export { default as warnings } from './models/warnings';
export { default as TinyDb } from './db/tiny-db';
export { default as Clock } from './helpers/observable-clock';
export { default as MRUList } from './helpers/mru-list';
export { WarningStates as warningStates } from './models/warnings/system-warning';
export { default as clientApp } from './models/client-app';
export { default as systemMessages } from './helpers/system-messages';
export { default as serverSettings } from './models/server-settings';
export { default as chatInviteStore } from './models/chats/chat-invite-store';
export { default as Contact } from './models/contacts/contact';
export { default as __tracker } from './models/update-tracker'; // Clients do not need it. Exported just for debugging.
export { default as CacheEngineBase } from './db/cache-engine-base';
export { default as saveAccountKeyBackup } from './helpers/pdf';

export { t } from './copy/t';
export { LocalizationStrings } from './copy/defs';

import * as validation from './helpers/validation/field-validation';
export { validation };
import * as util from './util';
export { util };
import * as errors from './errors';
export { errors };
import * as fileHelpers from './helpers/file';
export { fileHelpers };
import * as prombservable from './helpers/prombservable';
export { prombservable };
import * as telemetry from './telemetry';
export { telemetry };

import * as cryptoUtil from './crypto/util';
import * as keys from './crypto/keys';
import * as publicCrypto from './crypto/public';
import * as secret from './crypto/secret';
import * as sign from './crypto/sign';
import { setScrypt } from './crypto/scrypt-proxy';
export const crypto = { cryptoUtil, keys, publicCrypto, secret, sign, setScrypt };
