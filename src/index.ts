/**
 * Icebear client lib entry point.
 * @desc In addition to exporting public API, entry point, when first required,
 * performs some global configuration such as:
 * - replaces global Promise object with bluebird implementation. Note that native(not transpiled) async functions
 *  will still return native Promise.
 * - extends Uint8Array prototype. See {@link extensions/uint8array}.
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
import ghostStore from './models/mail/ghost-store';
import mailStore from './models/mail/mail-store';
import validation from './helpers/validation/field-validation';
import FileStreamAbstract from './models/files/file-stream-abstract';
import FileNonceGenerator from './models/files/file-nonce-generator';
import * as util from './util';
import warnings from './models/warnings';
import crypto from './crypto';
import TinyDb from './db/tiny-db';
import Clock from './helpers/observable-clock';
import fileHelpers from './helpers/file';
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
    ghostStore,
    mailStore,
    validation,
    FileStreamAbstract,
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
