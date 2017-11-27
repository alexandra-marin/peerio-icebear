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
        await u.login();
        return this.waitForAccountDataInit();
    }

    waitForAccountDataInit = async () => {
        const { asPromise, asPromiseNegative } = this.libs.prombservable;
        console.log('Account init: waiting for profile to load');
        await asPromise(this.ice.User.current, 'profileLoaded', true);
        console.log('Account init: waiting for quota to load');
        await asPromiseNegative(this.ice.User.current, 'quota', null);
        console.log('Account init: waiting for settings to load');
        await asPromise(this.ice.User.current.settings, 'loaded', true);
    }
}

defineSupportCode(({ setWorldConstructor }) => {
    setWorldConstructor(PeerioAppWorld);
});
