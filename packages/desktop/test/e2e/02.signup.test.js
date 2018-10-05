const { startApp, startAppAndConnect, closeApp, isDev } = require('./helpers');

describe('Signup: ', function() {
    setupTimeout(this);
    beforeEach(() => startAppAndConnect(this));
    afterEach(() => closeApp(this));

    before(() => {
        testUser.username = `t${Date.now()}`;
        testUser.passcode = 'icebearismypasscode';
    });

    function signUpWithBadPasscode(p) {
        return this.app.client
            .click('a:nth-of-type(1)')
            .waitForVisible('.signup')
            .setValue(
                'div.signup-form > div.profile > div:nth-child(3) input',
                testUser.username
            )
            .setValue(
                'div.signup-form > div.profile > div:nth-child(4) input',
                `${testUser.username}@mailinator.com`
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-first > div > div.rt-input-input > input',
                'firstnamebla'
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-second > div > div.rt-input-input > input',
                'lastnamebla'
            )
            .waitForEnabled('div.signup-nav > button:nth-child(2)', 10000)
            .click('div.signup-nav > button:nth-child(2)')
            .waitForEnabled(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input',
                10000
            )
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input',
                p
            )
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > input',
                p
            )
            .waitForVisible(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > .rt-input-error',
                10000
            );
    }

    it('will not accept a weak passcode: obvious words', () => {
        return signUpWithBadPasscode.bind(this)('peeriopassword');
    });

    it('will not accept a weak passcode: username', () => {
        return signUpWithBadPasscode.bind(this)(testUser.username);
    });

    it('will not accept a weak passcode: too short', () => {
        return signUpWithBadPasscode.bind(this)('t3gi');
    });

    it('will not accept an empty passcode', () => {
        return this.app.client
            .click('a:nth-of-type(1)')
            .waitForVisible('.signup')
            .setValue(
                'div.signup-form > div.profile > div:nth-child(3) input',
                testUser.username
            )
            .setValue(
                'div.signup-form > div.profile > div:nth-child(4) input',
                `${testUser.username}@mailinator.com`
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-first > div > div.rt-input-input > input',
                'firstnamebla'
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-second > div > div.rt-input-input > input',
                'lastnamebla'
            )
            .waitForEnabled('div.signup-nav > button:nth-child(2)', 10000)
            .click('div.signup-nav > button:nth-child(2)')
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input',
                ''
            )
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > input',
                ''
            )
            .click(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input'
            ) // blur
            .waitForVisible(
                'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > .rt-input-error',
                10000
            );
    });

    it('will not accept non-matching passcodes', () => {
        return this.app.client
            .click('a:nth-of-type(1)')
            .waitForVisible('.signup')
            .setValue(
                'div.signup-form > div.profile > div:nth-child(3) input',
                testUser.username
            )
            .setValue(
                'div.signup-form > div.profile > div:nth-child(4) input',
                `${testUser.username}@mailinator.com`
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-first > div > div.rt-input-input > input',
                'firstnamebla'
            )
            .setValue(
                'div.signup-form > div > div.input-row > div.test-second > div > div.rt-input-input > input',
                'lastnamebla'
            )
            .waitForEnabled('div.signup-nav > button:nth-child(2)', 10000)
            .click('div.signup-nav > button:nth-child(2)')
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input',
                testUser.passcode
            )
            .setValue(
                'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > input',
                `ee${testUser.passcode}`
            )
            .click(
                'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input'
            ) // blur
            .waitForVisible(
                'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > .rt-input-error',
                10000
            );
    });

    it('can sign up & create a passphrase', () => {
        return this.app.client
            .click('a:nth-of-type(1)')
            .waitForEnabled(
                'div.signup-form > div.profile > div:nth-child(3) input'
            )
            .then(() => {
                return this.app.client
                    .setValue(
                        'div.signup-form > div.profile > div:nth-child(3) input',
                        testUser.username
                    )
                    .setValue(
                        'div.signup-form > div.profile > div:nth-child(4) input',
                        `${testUser.username}@mailinator.com`
                    )
                    .setValue(
                        'div.signup-form > div > div.input-row > div.test-first > div > div.rt-input-input > input',
                        'firstnamebla'
                    )
                    .setValue(
                        'div.signup-form > div > div.input-row > div.test-second > div > div.rt-input-input > input',
                        'lastnamebla'
                    )
                    .waitForEnabled(
                        'div.signup-nav > button:nth-child(2)',
                        10000
                    )
                    .click('div.signup-nav > button:nth-child(2)')
                    .waitForVisible(
                        'div.signup-form > div > div:nth-child(4) > div.hint-wrapper',
                        10000
                    )
                    .setValue(
                        'div.signup-form > div > div:nth-child(4) > div.hint-wrapper > div > div > div.rt-input-input.login-input > input',
                        testUser.passcode
                    )
                    .setValue(
                        'div.signup-form > div > div:nth-child(4) > div > div.rt-input-input.login-input > input',
                        testUser.passcode
                    )
                    .waitForEnabled(
                        'div.signup.rt-light-theme.show > div > div.signup-nav > button:nth-child(2)',
                        10000
                    )
                    .click(
                        'div.signup.rt-light-theme.show > div > div.signup-nav > button:nth-child(2)'
                    )
                    .waitForVisible('.app-nav', 10000);
            })
            .then(() => {
                return this.app.client.execute(() => {
                    return ice.User.current.passphrase; // eslint-disable-line no-undef
                });
            })
            .then(v => {
                v.value.should.be.a('String');
                v.value.split(' ').length.should.equal(5);
                testUser.passphrase = v.value;
            });
    });
});
