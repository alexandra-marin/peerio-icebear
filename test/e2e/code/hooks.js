const { defineSupportCode } = require('cucumber');
const App = require('./app');

defineSupportCode(({ setDefaultTimeout, Before, After }) => {
    setDefaultTimeout(process.env.DEFAULT_TIMEOUT || 10000);

    Before(async function() {
        this.app = new App(this);
        this.app.start();
    });

    After(async function() {
        await this.app.dispose();
        this.attach(this.app.logs.join('\n\r'));
        delete this.app;
    });
});
