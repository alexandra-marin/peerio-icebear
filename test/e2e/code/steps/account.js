const { Given, When, Then } = require('cucumber');
const { waitForEmail } = require('../helpers/maildrop');
const { getUrl } = require('../helpers/https');
const testConfig = require('../test-config');
const { getRandomEmail, getRandomUsername } = require('../helpers/random-data');
const otplib = require('otplib');

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

When('I have not unlocked any storage', async function() {
    this.ice.User.current.currentOnboardingBonus.should.equal(0);
    this.previousBonus = this.ice.User.current.currentOnboardingBonus;
});

When('I save my account key as PDF document', async function() {
    await this.ice.User.current.setAccountKeyBackedUp();
});

When('I invite other users and they sign up', { timeout: 1000000 }, async function() {
    // Get 5 random emails
    const invitedEmails = Array(5).fill().map(getRandomEmail);

    // Invite them all to join
    await Promise.map(invitedEmails, (invited) => this.ice.contactStore.invite(invited));

    // Create accounts for all
    await Promise.map(invitedEmails, async (invited) => {
        await this.app.restart();
        await this.createTestAccount(getRandomUsername(), invited);
        await this.confirmPrimaryEmail(invited);
    }, { concurrency: 1 });

    await this.app.restart();
    await this.login();
});

When('I enable two-step verification', async function() {
    this.TOTPSecret = await this.ice.User.current.setup2fa();
    this.token = otplib.authenticator.generate(this.TOTPSecret);
    return this.ice.User.current.confirm2faSetup(this.token);
});

When('I install the mobile app', { timeout: 20000 }, async function() {
    // Login from ios
    await this.app.restart();
    this.ice.config.platform = 'ios';
    await this.login();
});

Then('I unlock {int}MB of storage', async function(int) {
    this.waitFor(() => this.ice.User.current.currentOnboardingBonus === this.previousBonus + int, 1000);
    this.previousBonus = this.ice.User.current.currentOnboardingBonus;
});

Then('I have received all bonuses', async function() {
    await this.waitFor(() => this.ice.User.current.hasAvatarUploadedBonus);
    await this.waitFor(() => this.ice.User.current.hasConfirmedEmailBonus);
    await this.waitFor(() => this.ice.User.current.hasInvitedFriendsBonus);
    await this.waitFor(() => this.ice.User.current.hasCreatedRoomBonus);
    await this.waitFor(() => this.ice.User.current.hasTwoFABonus);
    await this.waitFor(() => this.ice.User.current.hasAccountKeyBackedUpBonus);
    await this.waitFor(() => this.ice.User.current.hasInstallBonus);
});

Given('I create a MedCryptor account', { timeout: 60000 }, async function() {
    this.ice.config.appLabel = 'medcryptor';
    const medcryptorData = {
        specialization: 'cardiology',
        medicalID: '001',
        country: 'Canada',
        role: 'doctor'
    };

    await this.createMedcryptorAccount(medcryptorData);
    console.log(this.ice.User.current.props);
    this.ice.User.current.props.should.deep.equal(medcryptorData);
});

Then('I can edit specialization, medical ID, country and role', async function() {
    const medcryptorData = {
        specialization: 'admin',
        medicalID: '002',
        country: 'Australia',
        role: 'admin'
    };

    this.ice.User.current.props = medcryptorData;
    await this.ice.User.current.saveProfile();

    await this.app.restart();
    await this.login();

    this.ice.User.current.props.should.deep.equal(medcryptorData);
});
