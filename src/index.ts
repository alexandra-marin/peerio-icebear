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

// exporting Icebear Library Interface
export * from './network/socket';
export * from './models/user/user';
export * from './models/phrase-dictionary';
export * from './config';
export * from './models/contacts/contact-store';
export * from './models/contacts/tofu-store';
export * from './models/chats/chat-store';
export * from './models/files/file-store';
export * from './models/volumes/volume-store';
export * from './helpers/validation/field-validation';
export * from '~/models/files/file-stream-base';
export * from './models/files/file-nonce-generator';
export * from './models/warnings';
export * from './db/tiny-db';
export * from './helpers/observable-clock';
export * from './helpers/mru-list';
export { WarningStates as warningStates } from './models/warnings/system-warning';
export * from './models/client-app';
export * from './helpers/system-messages';
export * from './models/server-settings';
export * from './models/chats/chat-invite-store';
export * from './models/contacts/contact';
export * from './models/update-tracker';
export * from './db/cache-engine-base';

import * as _util from './util';
export const util = _util;

import * as _errors from './errors';
export const errors = _errors;

import * as _fileHelpers from './helpers/file';
export const fileHelpers = _fileHelpers;

import * as cryptoUtil from './crypto/util';
import * as keys from './crypto/keys';
import * as publicCrypto from './crypto/public';
import * as secret from './crypto/secret';
import * as sign from './crypto/sign';
import { setScrypt } from './crypto/scrypt-proxy';
export const crypto = { cryptoUtil, keys, publicCrypto, secret, sign, setScrypt };

import * as _prombservable from './helpers/prombservable';
export const prombservable = _prombservable;
