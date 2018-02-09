const { setDefaultTimeout, Before, After } = require('cucumber');
const App = require('./app');
const { deleteFile } = require('./helpers/files');


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
    this.filesToCleanup.forEach(f => deleteFile(f));
});
