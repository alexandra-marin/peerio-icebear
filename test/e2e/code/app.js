if (!console.debug) console.debug = console.log.bind(console);
global.XMLHttpRequest = require('w3c-xmlhttprequest').XMLHttpRequest;
global.WebSocket = require('websocket').w3cwebsocket;
const safeJsonStringify = require('safe-json-stringify');
const testConfig = require('./test-config');


/**
 * App class is supposed to emulate real-world application (sdk consumer).
 * It is able to reset current js environment, emulating application restart.
 *
 * set SHOW_APP_LOGS=1 env variable to see logs in console when developing
 *
 * GOTCHAS:
 * 1. Do not require any modules from test files, except cucumber and actual test code.
 * 2. Do not cache any of the things that App exposes, always use fully qualified path (this.ice.socket.connected)
 *    if you will put, let's say `this.ice.socket` to some local variable it might fail to collect next cycle.
 * 3. Do not use arrow functions in step definitions `Then('step',()=>{})`.
 *    Arrow function will get bound to a wrong object and you won't be able to access the world.
 * 4. One scenario can have multiple App instances. But one App instance can only belong to one scenario (world).
 */
class App {
    constructor(world) {
        this.world = world;
        this._captureConsole();
    }
    // Static, because we can't allow parallel "instances" to run
    static lastInstanceDisposed = true;
    // is the peerio app started?
    started = false;
    // logs of the current app (survives restart)
    logs = [];

    // configure assert library in here
    _setupChai() {
        const chai = require('chai');
        const chaiAsPromised = require('chai-as-promised');
        chai.should();
        chai.use(chaiAsPromised);
        global.expect = chai.expect;
    }

    // sdk configuration
    _configure() {
        const path = require('path');
        const os = require('os');
        const FileStream = require('~/models/files/node-file-stream');
        const StorageEngine = require('~/models/storage/node-json-storage');
        const cfg = this.world.ice.config;
        // todo: make special test platform?
        cfg.appVersion = '2.37.1';
        cfg.clientVersion = '2.9.0';
        cfg.platform = 'electron';
        cfg.arch = os.arch();
        cfg.os = os.type();
        cfg.FileStream = FileStream;
        cfg.StorageEngine = StorageEngine;
        cfg.StorageEngine.storageFolder = path.join(os.homedir(), '.peerio-icebear-tests');
        cfg.socketServerUrl = testConfig.socketServerUrl;
        if (testConfig.logSocketMessages) {
            cfg.debug = { trafficReportInterval: 5000, socketLogEnabled: true };
        }
    }

    // Add additional modules you want to expose to tests in here.
    _addLibraries() {
        this.world.libs = {
            mobx: require('mobx'),
            prombservable: require('~/helpers/prombservable')
        };
    }
    // writes console logs to this.logs instead of stdout/err
    _captureConsole() {
        this._consoleBackup = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };
        const write = (type, args) => {
            // DisconnectedError naturally happens all the time during tests.
            // It generates too much noise and hardly has any value, we can figure
            // out disconnection event from socket client log.
            // Sometimes it goes through console.log or warn in the app so we
            // have to catch it in here.
            if (args &&
                (args[0] && args[0].name === 'DisconnectedError')
                || (args[1] && args[1].name === 'DisconnectedError')
            ) return;

            let line = `${type}${new Date().toISOString()}: `;
            for (let i = 0; i < args.length; i++) {
                if (typeof args[i] === 'object') {
                    line += `${safeJsonStringify(args[i])} `;
                } else {
                    line += `${args[i]} `;
                }
            }
            this.logs.push(line);
            if (testConfig.showAppLogs) this._consoleBackup.log.call(console, line);
        };
        console.log = function(...args) {
            write('LOG:', args);
        };
        console.warn = function(...args) {
            write('WARN:', args);
        };
        console.error = function(...args) {
            write('ERR:', args);
        };
        console.debug = function(...args) {
            write('DEBUG:', args);
        };
    }

    _releaseConsole() {
        console.log = this._consoleBackup.log;
        console.warn = this._consoleBackup.warn;
        console.error = this._consoleBackup.error;
        console.debug = this._consoleBackup.debug;
    }

    // This function emulates application start and should be run before any scenario.
    start() {
        if (this.started) throw new Error('The test app is already started.');
        console.log('===== STARTING TEST APP =====');
        App.lastInstanceDisposed = false;
        this._setupChai();
        this.world.ice = require('~/');
        this._configure();
        this._addLibraries();
        this.world.ice.socket.start();
        this.started = true;
    }

    _clearModuleCache() {
        // clearing module cache
        Object.keys(require.cache).forEach(key => {
            delete require.cache[key];
        });
        if (Object.keys(require.cache).length) {
            throw new Error('Failed to clear require cache');
        }
        // resetting mobx (to stop existing reactions)
        delete global.__mobxInstanceCount;
        this.world.libs.mobx.extras.resetGlobalState();

        // deleting module references
        delete this.world.ice;
        delete this.world.libs;
    }

    // This function emulates application termination and should be run after every scenario.
    stop() {
        if (!this.started) throw new Error('The test app is not started.');
        console.log('===== STOPPING TEST APP =====');
        const { when } = require('mobx');
        // closing connections
        this.world.ice.socket.close();
        return new Promise((resolve) => {
            when(() => !this.world.ice.socket.connected, () => {
                this._clearModuleCache();
                // hell, yeah
                if (global.gc) global.gc();
                this.started = false;
                resolve();
            });
        });
    }

    async restart() {
        await this.stop();
        this.start();
    }

    async dispose() {
        if (this.started) await this.stop();
        this._releaseConsole();
        App.lastInstanceDisposed = true;
    }
}
module.exports = App;
