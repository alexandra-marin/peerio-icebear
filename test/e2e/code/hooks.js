const { defineSupportCode } = require('cucumber');
const App = require('./app');

defineSupportCode(({ setDefaultTimeout, Before, After }) => {
    setDefaultTimeout(process.env.DEFAULT_TIMEOUT || 10000);

    Before(async function() {
        this.app = new App(this);
        this.app.start();

        this.waitForObservable = (lambda, timeout) => {
            let resolve;
            const promise = new Promise((_resolve) => { resolve = _resolve; });
            const disposeReaction = this.libs.mobx.when(lambda, resolve);
            return promise.timeout(timeout).catch(err => {
                disposeReaction();
                if (err && err.name === 'TimeoutError') return Promise.resolve();
                return Promise.reject(err);
            });
        };
    });

    After(async function() {
        await this.app.dispose();
        const scenarioLog = this.app.logs.join('\n');
        this.attach(scenarioLog);
        delete this.app;
    });
});
