// @ts-check

/**
 * Icebear client lib entry point.
 * @desc In addition to exporting public API, entry point, when first required,
 * performs some global configuration such as:
 * - replaces global Promise object with bluebird implementation. Note that native(not transpiled) async functions
 *  will still return native Promise.
 * - extends Uint8Array prototype. See {@link extensions/uint8array}.
 */

require('./helpers/performance-polyfill');

// replacing native Promise with bluebird implementation
const Promise = require('bluebird');
const globalContext = require('./helpers/global-context');

// @ts-ignore
globalContext.Promise = Promise;

// Enables all warnings except forgotten return statements.
Promise.config({ warnings: { wForgottenReturn: false } });

// @ts-ignore
// extending native classes
require('./extensions/uint8array');

// @ts-ignore
// for JSDoc's sake
require('./typedefs');

// exporting Icebear Library Interface
const socket = require('./network/socket');
const User = require('./models/user/user');
const PhraseDictionary = require('./models/phrase-dictionary');
const config = require('./config');
const errors = require('./errors');
const contactStore = require('./models/contacts/contact-store');
const tofuStore = require('./models/contacts/tofu-store');
const chatStore = require('./models/chats/chat-store');
const fileStore = require('./models/files/file-store');
const volumeStore = require('./models/volumes/volume-store');
const ghostStore = require('./models/mail/ghost-store');
const mailStore = require('./models/mail/mail-store');
const validation = require('./helpers/validation/field-validation');
const FileStreamAbstract = require('./models/files/file-stream-abstract');
const FileNonceGenerator = require('./models/files/file-nonce-generator');
const util = require('./util');
const warnings = require('./models/warnings');
const crypto = require('./crypto');
const TinyDb = require('./db/tiny-db');
const Clock = require('./helpers/observable-clock');
const fileHelpers = require('./helpers/file');
const MRUList = require('./helpers/mru-list');
const warningStates = require('./models/warnings/system-warning').STATES;
const clientApp = require('./models/client-app');
const systemMessages = require('./helpers/system-messages');
const serverSettings = require('./models/server-settings');
const chatInviteStore = require('./models/chats/chat-invite-store');
const Contact = require('./models/contacts/contact');
const prombservable = require('./helpers/prombservable');
const tracker = require('./models/update-tracker');
const telemetry = require('./telemetry');


// MEMO: Do NOT export NodeJsonStorage and NodeFileStream here for compatibility reasons
module.exports = {
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
    __: {
        tracker
    },
    telemetry
};
