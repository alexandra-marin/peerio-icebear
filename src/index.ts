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
import * as Bluebird from 'bluebird';
import globalContext from './helpers/global-context';

globalContext.Promise = Bluebird;

//@ts-ignore
Bluebird.coroutine.addYieldHandler(function(value) {
    return Bluebird.resolve(value);
});

// Enables all warnings except forgotten return statements.
Bluebird.config({ warnings: { wForgottenReturn: false } });

// extending native classes
import './extensions/uint8array';

// exporting Icebear Library Interface
import socket from './network/socket';
import User from './models/user/user';
import PhraseDictionary from './models/phrase-dictionary';
import config from './config';
import * as errors from './errors';
import contactStore from './models/contacts/contact-store';
import tofuStore from './models/contacts/tofu-store';
import chatStore from './models/chats/chat-store';
import fileStore from './models/files/file-store';
import volumeStore from './models/volumes/volume-store';
import validation from './helpers/validation/field-validation';
import FileStreamBase from '~/models/files/file-stream-base';
import FileNonceGenerator from './models/files/file-nonce-generator';
import * as util from './util';
import warnings from './models/warnings';
import * as cryptoUtil from './crypto/util';
import * as keys from './crypto/keys';
import * as publicCrypto from './crypto/public';
import * as secret from './crypto/secret';
import * as sign from './crypto/sign';
import { setScrypt } from './crypto/scrypt-proxy';
import TinyDb from './db/tiny-db';
import Clock from './helpers/observable-clock';
import * as fileHelpers from './helpers/file';
import MRUList from './helpers/mru-list';
import { WarningStates as warningStates } from './models/warnings/system-warning';
import clientApp from './models/client-app';
import systemMessages from './helpers/system-messages';
import serverSettings from './models/server-settings';
import chatInviteStore from './models/chats/chat-invite-store';
import Contact from './models/contacts/contact';
import * as prombservable from './helpers/prombservable';
import tracker from './models/update-tracker';
import CacheEngineBase from './db/cache-engine-base';

const crypto = { cryptoUtil, keys, publicCrypto, secret, sign, setScrypt };

// MEMO: Do NOT export NodeJsonStorage and NodeFileStream here for compatibility reasons
export default {
    errors,
    config,
    socket,
    crypto,
    User,
    PhraseDictionary,
    TinyDb,
    contactStore,
    tofuStore,
    chatStore,
    chatInviteStore,
    fileStore,
    volumeStore,
    validation,
    FileStreamBase,
    FileNonceGenerator,
    util,
    warnings,
    warningStates,
    Clock,
    fileHelpers,
    MRUList,
    clientApp,
    systemMessages,
    serverSettings,
    Contact, // mostly for its utility static functions
    prombservable,
    CacheEngineBase,
    __: {
        tracker
    }
};
