const { defineSupportCode } = require('cucumber');
const App = require('./app');

defineSupportCode(({ setDefaultTimeout, Before, After }) => {
    setDefaultTimeout(process.env.DEFAULT_TIMEOUT || 10000);

    // before each scenario
    Before(async function() {
        this.app = new App(this);
        this.app.start();
    });

    // after each scenario
    After(async function() {
        await this.app.dispose();
        const scenarioLog = this.app.logs.join('\n');
        this.attach(scenarioLog);
        delete this.app;
    });
});
