const { Given, When, Then } = require('cucumber');
const { waitForEmail } = require('../helpers/maildrop');
const { getUrl } = require('../helpers/https');
const testConfig = require('../test-config');


Given('I confirm the primary email', { timeout: 120000 }, async function() {
    const email = await waitForEmail(
        this.ice.User.current.addresses[0].address,
        testConfig.primaryEmailConfirmSubject
    );
    const url = testConfig.emailConfirmUrlRegex.exec(email.body)[1];
    await getUrl(url);
    // giving confirmed status a chance to propagate
    return this.waitFor(
        () => this.ice.User.current.primaryAddressConfirmed === true, 5000
    );
});

Then('my primary email is confirmed', function() {
    this.ice.User.current.primaryAddressConfirmed.should.be.true;
});

When('I delete my account', { timeout: 7000 }, async function() {
    await this.ice.User.current.deleteAccount(this.username);
    return this.waitFor(() => this.ice.socket.authenticated === false, 5000);
});

Then('I am not able to login', function() {
    return this.login().should.be.rejected;
});

Then('I should not have paid plans', function() {
    this.ice.User.current.hasActivePlans.should.be.false;
});

Then('I should have default account settings', async function() {
    const { settings } = this.ice.User.current;
    settings.contactNotifications.should.be.false;
    settings.contactRequestNotifications.should.be.false;
    settings.messageNotifications.should.be.true;
    settings.errorTracking.should.be.false;
    settings.dataCollection.should.be.false;
    settings.subscribeToPromoEmails.should.be.false;
});

When('I change my account settings', async function() {
    const { settings } = this.ice.User.current;
    settings.contactNotifications = true;
    settings.contactRequestNotifications = true;
    settings.messageNotifications = false;
    settings.errorTracking = true;
    settings.dataCollection = true;
    settings.subscribeToPromoEmails = true;
    await this.ice.User.current.saveSettings();
    return this.waitFor(() => settings.version === 2, 5000);
});

Then('my account settings are changed', async function() {
    const { settings } = this.ice.User.current;
    settings.contactNotifications.should.be.true;
    settings.contactRequestNotifications.should.be.true;
    settings.messageNotifications.should.be.false;
    settings.errorTracking.should.be.true;
    settings.dataCollection.should.be.true;
    settings.subscribeToPromoEmails.should.be.true;
});

