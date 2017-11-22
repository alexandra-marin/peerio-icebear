const { defineSupportCode } = require('cucumber');
const { getRandomUsername } = require('./helpers/random-data');
const { waitForEmail } = require('./helpers/maildrop');
const { getUrl } = require('./helpers/https');
const quotedPrintable = require('quoted-printable');

// todo: conditional '(Staging)' based on testing env
const mailConfirmSubject = 'Welcome to Peerio (Staging)! Confirm your account.';
const mailConfirmUrlRegex = /"(https:\/\/hocuspocus\.peerio\.com\/confirm-address\/.*?)"/;

defineSupportCode(({ Given, When, Then }) => {
    // creates new account, authenticates and stores username and passphrase in the world
    Given('I create an account', async function() {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);

        const u = new this.ice.User();
        u.username = getRandomUsername();
        u.email = `${u.username}@maildrop.cc`;
        u.firstName = 'Firstname';
        u.lastName = 'Lastname';
        u.locale = 'en';
        u.passphrase = 'passphrase';
        this.ice.User.current = u;

        this.username = u.username;
        this.passphrase = u.passphrase;
        console.log(`creating user username: ${this.username} passphrase: ${this.passphrase}`);

        return u.createAccountAndLogin();
    });

    // checks socket status
    Then('I am authenticated', function() {
        expect(this.ice.socket.authenticated).to.be.true;
    });

    Then('I am not authenticated', function() {
        expect(this.ice.socket.authenticated).to.be.false;
    });

    // emulates application restart
    When('I restart', function() {
        return this.app.restart();
    });

    async function login() {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);
        const u = new this.ice.User();
        u.username = this.username;
        u.passphrase = this.passphrase;
        this.ice.User.current = u;
        return u.login();
    }
    // authenticates with username and passphrase found in the world
    When('I login', login);

    Given('I confirm my primary email', { timeout: 30000 }, function() {
        return waitForEmail(this.username, mailConfirmSubject).then(email => {
            email.body = quotedPrintable.decode(email.body);
            const url = mailConfirmUrlRegex.exec(email.body)[1];
            return getUrl(url);
        }).then(() => {
            // giving confirmed status a chance to propagate
            return this.waitForObservable(() => this.ice.User.current.primaryAddressConfirmed === true, 3000);
        });
    });

    Then('My primary email is confirmed', function() {
        this.ice.User.current.primaryAddressConfirmed.should.be.true;
    });

    When('I delete my account', { timeout: 7000 }, function() {
        return this.ice.User.current.deleteAccount(this.username).then(() => {
            return this.waitForObservable(() => this.ice.socket.authenticated === false, 5000);
        });
    });

    Then('I am not able to login', function() {
        return login.call(this).should.be.rejected;
    });
});
