const { Given, When, Then } = require('cucumber');
const { getRandomEmail, getRandomUsername } = require('../helpers/random-data');
const otplib = require('otplib');

Given('I confirm the primary email', { timeout: 4000000 }, async function() {
    await this.confirmPrimaryEmail(ice.User.current.addresses[0].address);
    // giving confirmed status a chance to propagate
    return this.waitFor(() => ice.User.current.primaryAddressConfirmed === true);
});

Then('my primary email is confirmed', function() {
    ice.User.current.primaryAddressConfirmed.should.be.true;
});

When('I delete my account', async function() {
    await ice.User.current.deleteAccount(this.username);
    return this.waitFor(() => ice.socket.authenticated === false);
});

Then('I am not able to login', function() {
    return this.login().should.be.rejected;
});

Then('I should not have paid plans', function() {
    ice.User.current.hasActivePlans.should.be.false;
});

Then('I should have default account settings', async function() {
    const { settings } = ice.User.current;
    settings.contactNotifications.should.be.false;
    settings.contactRequestNotifications.should.be.false;
    settings.messageNotifications.should.be.true;
    settings.errorTracking.should.be.false;
    settings.dataCollection.should.be.false;
    settings.subscribeToPromoEmails.should.be.false;
});

When('I change my account settings', async function() {
    const { settings } = ice.User.current;
    settings.contactNotifications = true;
    settings.contactRequestNotifications = true;
    settings.messageNotifications = false;
    settings.errorTracking = true;
    settings.dataCollection = true;
    settings.subscribeToPromoEmails = true;
    await ice.User.current.saveSettings();
    return this.waitFor(() => settings.version === 2);
});

Then('my account settings are changed', async function() {
    const { settings } = ice.User.current;
    settings.contactNotifications.should.be.true;
    settings.contactRequestNotifications.should.be.true;
    settings.messageNotifications.should.be.false;
    settings.errorTracking.should.be.true;
    settings.dataCollection.should.be.true;
    settings.subscribeToPromoEmails.should.be.true;
});

When('I have not unlocked any storage', async function() {
    ice.User.current.currentOnboardingBonus.should.equal(0);
    this.previousBonus = ice.User.current.currentOnboardingBonus;
});

When('I save my account key as PDF document', async function() {
    await ice.User.current.setAccountKeyBackedUp();
});

When('I invite other users and they sign up', { timeout: 1000000 }, async function() {
    const userCount = 5;
    // Get userCount random emails
    const invitedEmails = Array(userCount)
        .fill()
        .map(getRandomEmail);

    // Invite them all to join
    await Promise.map(invitedEmails, invited => ice.contactStore.invite(invited));

    // Create accounts for all
    await Promise.map(
        invitedEmails,
        async invited => {
            await this.app.restart();
            await this.createTestAccount(getRandomUsername(), invited);
        },
        { concurrency: 1 }
    );

    // confirmPrimaryEmail is an independent from current context/world helper method
    // so it's safe to call it here for all the users
    await Promise.map(invitedEmails, invited => this.confirmPrimaryEmail(invited), {
        concurrency: userCount
    });

    await this.app.restart();
    await this.login();
});

When('I enable two-step verification', async function() {
    this.TOTPSecret = await ice.User.current.setup2fa();
    this.token = otplib.authenticator.generate(this.TOTPSecret);
    return ice.User.current.confirm2faSetup(this.token);
});

When('I install the mobile app', async function() {
    // Login from ios
    await this.app.restart();
    ice.config.platform = 'ios';
    await this.login();
});

Then('I unlock {int}MB of storage', async function(int) {
    await this.waitFor(() => ice.User.current.currentOnboardingBonus === this.previousBonus + int);
    this.previousBonus = ice.User.current.currentOnboardingBonus;
});

Then('I have received all bonuses', async function() {
    await this.waitFor(() => ice.User.current.hasAvatarUploadedBonus);
    await this.waitFor(() => ice.User.current.hasConfirmedEmailBonus);
    await this.waitFor(() => ice.User.current.hasInvitedFriendsBonus);
    await this.waitFor(() => ice.User.current.hasCreatedRoomBonus);
    await this.waitFor(() => ice.User.current.hasTwoFABonus);
    await this.waitFor(() => ice.User.current.hasAccountKeyBackedUpBonus);
    await this.waitFor(() => ice.User.current.hasInstallBonus);
});
