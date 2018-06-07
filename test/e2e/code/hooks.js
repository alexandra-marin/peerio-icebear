const { setDefaultTimeout, Before, After, setDefinitionFunctionWrapper } = require('cucumber');
const App = require('./app');
const { deleteFile } = require('./helpers/files');
const CucumbotClient = require('./helpers/cucumbot-client');
const CucumbotServer = require('./helpers/cucumbot-server');

setDefaultTimeout(process.env.DEFAULT_TIMEOUT || 60000);

// before each scenario
Before({ wrapperOptions: { noWrap: true } }, function(data) {
    this.pickle = data.pickle;
    this.currentStep = -1;
    this.app = new App(this);
    this.app.start();
    return startCucumbotBeforeScenario(this);
});

// after each scenario
After({ wrapperOptions: { noWrap: true }, timeout: -1 }, async function() {
    let cucumbotSuccess = false;
    try {
        cucumbotSuccess = await checkCucumbotRunResult(this).timeout(5 * 60000);
    } catch (err) {
        // don't care
    }
    await this.app.dispose();
    const scenarioLog = this.app.logs.join('\n');
    this.attach(scenarioLog);
    delete this.app;
    this.filesToCleanup.forEach(f => deleteFile(f));
    if (!cucumbotSuccess) return Promise.reject(new Error('Cucumbot scenario failed'));
    return Promise.resolve();
});

setDefinitionFunctionWrapper(function(fn, opts) {
    // we don't want to wrap hook definitions
    if (opts && opts.noWrap) return fn;
    return function(...args) {
        this.currentStep++;
        const cucumbot = this.cucumbotClient || this.cucumbotServer;
        // no cucumbot - just run the step function
        if (!cucumbot) return fn.apply(this, args);

        // where is current step supposed to run?
        const isServerStep = this.pickle.steps[this.currentStep].text.startsWith('Cucumbot');

        // run the step or pass control
        if (this.cucumbotServer && isServerStep || this.cucumbotClient && !isServerStep) {
            return cucumbot.onceHaveControl(() => fn.apply(this, args));
        }

        return cucumbot.passControl();
    };
});

/**
 * Starts Cucumbot client or server or nothing depending on scenario needs.
 * @returns {Promise}
 */
function startCucumbotBeforeScenario(world) {
    //= = 1. Either we are the cucumbot
    if (process.env.CUCUMBOT) {
        world.cucumbotServer = new CucumbotServer(world);
        if (process.env.CUCUMBOT_DONT_CREATE_ACCOUNT) {
            world.cucumbotServer.sendReady();
            return Promise.resolve();
        }
        return world.cucumbotServer.createAccount();
    }
    //= = 2. Or we are the cucumbot client
    const { tags } = world.pickle;
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].name.startsWith('@BOT_')) {
            // need to spawn a bot
            world.cucumbotClient = new CucumbotClient(tags[i].name.substring(1), world);
            return world.cucumbotClient.start(tags[i].name.startsWith('@BOT_NO_ACCOUNT_'));
        }
    }
    //= = 3. Or we don't need Cucumbot in this scenario
    return Promise.resolve();
}

/**
 * Checks if last Cucumbot run was successful or not
 * @returns {Promise} - resolves if all good or if cucumbot didn't exist for this test case
 */
function checkCucumbotRunResult(world) {
    if (!world.cucumbotClient) {
        return Promise.resolve(true);
    }
    if (world.cucumbotClient.finished) {
        if (world.cucumbotClient.finishedWithError) {
            console.error('Oh no, Cucumbot run was not successful.');
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        world.cucumbotClient.once('finished', () => checkCucumbotRunResult(world).then(resolve));
    });
}
