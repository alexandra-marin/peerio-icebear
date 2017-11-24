const { defineSupportCode } = require('cucumber');

class PeerioAppWorld {
    constructor({ attach, parameters }) {
        this.attach = attach;
        this.parameters = parameters;
    }

    waitForObservable = (lambda, timeout = 5000) => {
        let resolve;
        const promise = new Promise((_resolve) => { resolve = _resolve; });
        const disposeReaction = this.libs.mobx.when(lambda, resolve);
        return promise.timeout(timeout).catch(err => {
            disposeReaction();
            if (err && err.name === 'TimeoutError') return Promise.resolve();
            return Promise.reject(err);
        });
    };

    login = async () => {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);
        const u = new this.ice.User();
        u.username = this.username;
        u.passphrase = this.passphrase;
        this.ice.User.current = u;
        return u.login();
    }
}

defineSupportCode(({ setWorldConstructor }) => {
    setWorldConstructor(PeerioAppWorld);
});
