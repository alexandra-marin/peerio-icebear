const { setWorldConstructor } = require('cucumber');
const { getUrl } = require('./helpers/https');
const { waitForEmail } = require('./helpers/maildrop');
const { getRandomUsername } = require('./helpers/random-data');
const testConfig = require('./test-config');

/**
 * Cucumber creates an instance of this class for each scenario.
 * Each scenario step runs in context of the PeerioAppWorld instance,
 * meaning you can access it with 'this' keyword.
 */
class PeerioAppWorld {
    constructor({ attach, parameters }) {
        this.attach = attach;
        this.parameters = parameters;
        this.filesToCleanup = [];
    }

    /**
     * Waits for mobx `when` to get executed for a specific amount of time and timeouts.
     */
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

    login = async (username, passphrase) => {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);
        const u = new this.ice.User();
        u.username = username || this.username;
        u.passphrase = passphrase || this.passphrase;
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
        console.log('Account init: waiting for tofuStore to load');
        await asPromise(this.ice.tofuStore, 'loaded', true);
        console.log('Account init: waiting for contactStore to load');
        await asPromise(this.ice.contactStore.myContacts.loaded, true);
        console.log('Account init: waiting self contact info to load');
        await this.ice.contactStore.currentUser.ensureLoaded();
    }

    confirmPrimaryEmail = async (emailAddress) => {
        const email = await waitForEmail(emailAddress, testConfig.primaryEmailConfirmSubject);
        const url = testConfig.emailConfirmUrlRegex.exec(email.body)[1];
        await getUrl(url);
    }

    createAccount = async (username, email, isTestAccount = false) => {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);

        const u = new this.ice.User();
        u.username = username || getRandomUsername();
        u.email = email || `${u.username}@${testConfig.emailDomain}`;
        u.firstName = 'Firstname';
        u.lastName = 'Lastname';
        u.locale = 'en';
        u.passphrase = testConfig.defaultPassphrase;
        this.ice.User.current = u;
        if (!isTestAccount) {
            this.username = u.username;
            this.passphrase = u.passphrase;
        } else {
            this.testAccount = {
                username: u.username,
                passphrase: u.passphrase,
                email: u.email
            };
        }

        console.log(`creating user username: ${this.username} passphrase: ${this.passphrase}`);

        await u.createAccountAndLogin();
        console.log('Account created, waiting for initialization.');
        await this.waitForAccountDataInit();
    };

    createTestAccount = async (username = null, email = null) => {
        return this.createAccount(username, email, true);
    }
}


setWorldConstructor(PeerioAppWorld);

