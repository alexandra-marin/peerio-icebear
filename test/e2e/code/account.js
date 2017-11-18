const defineSupportCode = require('cucumber').defineSupportCode;
const { getRandomUsername } = require('./helpers/random-data');
// const { confirmUserEmail } = require('./helpers/mailinatorHelper');


defineSupportCode(({ Then, When }) => {
    When('I create an account', async function() {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);

        const u = new this.ice.User();
        u.username = getRandomUsername();
        u.email = `${u.username}@mailinator.com`;
        u.firstName = 'Firstname';
        u.lastName = 'Lastname';
        u.locale = 'en';
        u.passphrase = 'passphrase';
        this.ice.User.current = u;

        this.username = u.username;
        this.passphrase = u.passphrase;
        console.log('creating user', this.username, this.passphrase);

        return u.createAccountAndLogin();
    });

    Then('I am authenticated', function() {
        expect(this.ice.socket.authenticated).to.be.true;
    });

    When('I restart', function() {
        return this.app.restart();
    });

    When('I login', async function() {
        await this.libs.prombservable.asPromise(this.ice.socket, 'connected', true);
        const u = new this.ice.User();
        u.username = this.username;
        u.passphrase = this.passphrase;
        this.ice.User.current = u;
        return u.login();
    });
});
