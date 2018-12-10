process.on('uncaughtException', function(err) {
    console.error(err);
    console.error(err.stack);
});

// Nodejs needs some polyfills
const { XMLHttpRequest } = require('w3c-xmlhttprequest');
const { w3cwebsocket } = require('websocket');
global.XMLHttpRequest = XMLHttpRequest;
global.WebSocket = w3cwebsocket;

const os = require('os');
const faker = require('faker');
const fetch = require('cross-fetch');
const { ipcSend, getRandomUsername } = require('./bullet_process_helpers');
const { asPromise, asPromiseNegative } = require('../../dist/helpers/prombservable');

// platform specific implementations
const FileStream = require('../../dist/models/files/node-file-stream').default;
const StorageEngine = require('../../dist/models/storage/memory-storage').default;
const MemoryCacheEngine = require('../../dist/db/memory-cache-engine').default;

// global sdk api access
global.ice = require('../../dist');

// configuration
const cfg = ice.config;
cfg.appVersion = '200.0.0';
cfg.clientVersion = '200.0.0';
cfg.platform = 'electron';
cfg.whiteLabel.name = '';
cfg.arch = os.arch();
cfg.os = os.type();
cfg.FileStream = FileStream;
cfg.StorageEngine = StorageEngine;
cfg.CacheEngine = MemoryCacheEngine;
cfg.socketServerUrl = 'wss://hocuspocus.peerio.com';
// if (process.argv[2] === 'host') {
//     cfg.debug = { socketLogEnabled: true };
// }

// ready to connect
ice.socket.start();

(async function() {
    await asPromise(ice.socket, 'connected', true);
    // creating account
    const u = new ice.User();
    u.username = getRandomUsername();
    u.email = `${u.username}@mailinator.com`;
    u.firstName = faker.name.firstName();
    u.lastName = faker.name.lastName();
    u.locale = 'en';
    u.passphrase = '123456';
    ice.User.current = u;

    await u.createAccountAndLogin();
    await asPromise(ice.User.current, 'profileLoaded', true);
    await asPromiseNegative(ice.User.current, 'quota', null);
    await asPromise(ice.User.current.settings, 'loaded', true);
    await asPromise(ice.tofuStore, 'loaded', true);
    await asPromise(ice.contactStore.myContacts.loaded, true);
    await asPromise(ice.chatStore.loaded, true);
    await ice.contactStore.currentUser.ensureLoaded();
    const resp = await fetch(faker.image.avatar());
    const blob = await resp.arrayBuffer();
    await u.saveAvatar([blob, blob]);
    // notifying parent
    ipcSend('ready', { username: u.username });
})();
