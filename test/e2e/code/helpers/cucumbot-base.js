const { EventEmitter } = require('eventemitter3');

class CucumbotBase extends EventEmitter {
    // positive number indicates the amount of times current process has permission
    // to execute a step it's supposed to execute
    hasControl = 0;
    // according to our logic, not more one function (step) can be awaiting control
    controlAwaitingFn = null;
    username = '';

    // extend in child classes
    messageHandlers = {
        takeControl: this.takeControl,
        ready: this.onReady
    };

    constructor(world) {
        super();
        this.world = world;
    }

    onceHaveControl(fn) {
        if (this.controlAwaitingFn) throw new Error('Can not have more then 1 step awaiting control');
        if (this.hasControl) {
            this.hasControl--;
            return fn();
        }
        return new Promise((resolve) => {
            this.controlAwaitingFn = () => {
                this.hasControl--;
                const res = fn();
                if (res && typeof res.then === 'function') {
                    res.then(resolve);
                } else resolve(res);
            };
        });
    }

    takeControl() {
        this.hasControl++;
        if (this.controlAwaitingFn) {
            this.controlAwaitingFn();
            this.controlAwaitingFn = null;
        }
    }

    onReady(msg) {
        this.username = msg.data.username;
        this.emit('ready');
    }

    sendReady() {
        (this.botProcess || process).send({
            type: 'ready',
            data: {
                username: this.world.username
            }
        });
    }

    passControl() {
        (this.botProcess || process).send({ type: 'takeControl' });
    }

    processMessage = (msg) => {
        const handler = this.messageHandlers[msg.type];
        if (!handler) console.error('Unknown Cucumbot IPC message.', msg);
        else handler.call(this, msg);
    };
}

module.exports = CucumbotBase;
