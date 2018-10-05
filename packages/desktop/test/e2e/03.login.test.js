const { startAppAndConnect, login, closeApp, isDev } = require('./helpers');

describe('Login:', function() {
    setupTimeout(this);
    beforeEach(() => startAppAndConnect(this));
    afterEach(() => closeApp(this));

    it('can log in with passphrase', () => {
        return login(this);
    });

    // it('can set a passcode', function() {

    // });

    // it('returning user can unset remembered status, still use passcode', function() {

    // });

    // it('cannot log in with bad password/passcode', function() {
    // this will be very slow
    // });

    // it('cannot log in with legacy username', function() {

    // });
});
