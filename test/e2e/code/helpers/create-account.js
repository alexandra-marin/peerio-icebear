const { getRandomUsername } = require('../helpers/random-data');
const testConfig = require('../test-config');

class AccountHelper {
    constructor(world) {
        this.world = world;
    }

    createAccount = async (username, email, isTestAccount = false, extraProps = null) => {
        await this.world.libs.prombservable.asPromise(ice.socket, 'connected', true);

        const u = new ice.User();
        u.username = username || getRandomUsername();
        u.email = email || `${u.username}@${testConfig.emailDomain}`;
        u.firstName = 'Firstname';
        u.lastName = 'Lastname';
        u.locale = 'en';
        u.passphrase = testConfig.defaultPassphrase;
        u.props = extraProps;
        ice.User.current = u;
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

        console.log(`creating ${isTestAccount ? 'test ' : ''}user username: ${u.username} passphrase: ${u.passphrase}`);

        await u.createAccountAndLogin();
        console.log('Account created, waiting for initialization.');
        await this.world.waitForAccountDataInit();
    };

    createTestAccount = async (username = null, email = null) => {
        return this.createAccount(username, email, true);
    }
}


module.exports = AccountHelper;
