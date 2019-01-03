/**
 * This is Peerio app instance (bullet) controller.
 */
const cp = require('child_process');

const { TELEMETRY_INTERVAL, EXTRA_USERS, PRINT_HOST_STDOUT } = require('./config');

let maxBulletId = 0;
class Bullet {
    constructor(logger, isHost = false) {
        this.id = maxBulletId++;
        this.logger = logger;
        this.isHost = isHost;
    }

    formatMsg(msg) {
        return `[bullet ${this.id}] ${msg}`;
    }

    log(msg) {
        this.logger.info(this.formatMsg(msg));
    }

    err(msg) {
        this.logger.error(this.formatMsg(msg));
    }

    fire() {
        this.log('Spawning process');
        this.proc = cp.spawn(
            'node',
            [`${__dirname}/bullet_process.js`, this.isHost ? 'host' : ''],
            {
                stdio: [null, 'pipe', 'pipe', 'ipc'] // stdin, stdout, stderr, + open ipc channel
            }
        );
        let onReady;
        const promise = new Promise(resolve => {
            onReady = resolve;
        });

        this.proc.on('message', msg => {
            switch (msg.type) {
                case 'ready':
                    this.username = msg.data.username;
                    this.log(`ready, username: ${this.username}`);
                    onReady();
                    break;
                case 'log':
                    this.log(msg.data.message);
                    break;
                default:
                    this.err(`Unknown message type ${msg.type}`);
            }
        });

        this.proc.on('close', code => {
            this.log(`Process stopped with code ${code}`);
        });

        this.proc.on('error', err => {
            this.err(`Process error ${err}`);
        });

        if (this.isHost && PRINT_HOST_STDOUT) {
            this.proc.stdout.on('data', function(data) {
                process.stdout.write(data);
            });
            this.proc.stderr.on('data', function(data) {
                process.stderr.write(data);
            });
        }
        return promise;
    }

    ipcSend(type, data) {
        this.proc.send({ type, data });
    }
    rce(code) {
        this.ipcSend('rce', { code });
    }

    startChat(_usernames) {
        const usernames = _usernames.concat(EXTRA_USERS);
        this.ipcSend('startChat', { usernames });
        this.ipcSend('setAdmins', { usernames: EXTRA_USERS });
    }

    startTelemetryReports() {
        setInterval(() => {
            this.rce('logTelemetry()');
        }, TELEMETRY_INTERVAL);
    }
}

module.exports = Bullet;
