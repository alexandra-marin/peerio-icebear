const defineSupportCode = require('cucumber').defineSupportCode;
const { when } = require('mobx');
const { asPromise } = require('../../../src/helpers/prombservable');
const { waitForConnection, setCurrentUser } = require('./client');
const getAppInstance = require('./helpers/appConfig');

defineSupportCode(({ setDefaultTimeout, Before, Given }) => {
    // let username, passphrase;
    let username = 'v9ul3pmbaaxgb0nqsb4sc63pn502ly', passphrase = 'secret secrets';

    setDefaultTimeout(10000);

    const setCredentialsIfAny = () => {
        if (process.env.peerioData) {
            const data = JSON.parse(process.env.peerioData);
            ({ username, passphrase } = data);
        }
    };

    Before(() => {
        return waitForConnection()
            .then(setCredentialsIfAny);
    });

    Given('I am logged in', (done) => {
        const app = getAppInstance();
        const currentUser = setCurrentUser(username, passphrase);
        currentUser.login()
            .then(() => asPromise(app.socket, 'authenticated', true))
            .then(() => asPromise(app.User.current, 'profileLoaded', true))
            .then(() => asPromise(app.fileStore, 'loading', false))
            .then(() => when(() => app.User.current.quota, done));
    });
});
