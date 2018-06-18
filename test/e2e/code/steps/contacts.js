const { Then, When } = require('cucumber');
const { getRandomUsername } = require('../helpers/random-data');
const { waitForEmail } = require('../helpers/maildrop');
const testConfig = require('../test-config');

Then('I can not find unregistered account by random username', function() {
    const username = getRandomUsername();
    const contact = ice.contactStore.getContact(username);
    return this.waitFor(() => contact.notFound === true);
});

Then('I can find the test account by email', async function() {
    const contact = await this.contactsHelper.findContact(this.testAccount.email);
    contact.username.should.equal(this.testAccount.username);
});

Then('I can find the test account by username', async function() {
    const contact = await this.contactsHelper.findContact(this.testAccount.username);
    contact.addresses[0].should.equal(this.testAccount.email);
});

Then('test account is not added to my contacts', function() {
    expect(ice.contactStore
        .contacts.find(c => c.username === this.testAccount.username))
        .to.be.undefined;
});

When('I favorite the test account', function() {
    return ice.contactStore.addContact(this.testAccount.username);
});

When('I unfavorite the test account', function() {
    return ice.contactStore.removeContact(this.testAccount.username);
});

When('the test account is my favorite contact', function() {
    const c = ice.contactStore.getContact(this.testAccount.username);
    c.isAdded.should.be.true;
});

When('the test account is not my favorite contact', function() {
    const c = ice.contactStore.getContact(this.testAccount.username);
    c.isAdded.should.be.false;
});

When('I invite random email', async function() {
    await this.contactsHelper.inviteRandomEmail();
    return ice.contactStore.invite(this.invitedEmail);
});

When('I create a test account with invited email', function() {
    return this.createTestAccount(null, this.invitedEmail);
});

Then('the invite is converted to pending dm', async function() {
    const c = this.ice.contactStore.getContact(this.invitedEmail);
    await this.waitFor(() => !c.loading);
    expect(!!this.ice.chatStore.directMessages.find(
        chat => chat.isInvite && chat.username === c.username)).to.be.true;
});

When('I delete invited random email', function() {
    return ice.contactStore.removeInvite(this.invitedEmail);
});

Then('I don\'t have pending dm', async function() {
    const c = this.ice.contactStore.getContact(this.invitedEmail);
    await this.waitFor(() => !c.loading);
    expect(!!this.ice.chatStore.directMessages.find(
        chat => chat.isInvite && chat.username === c.username)).to.be.false;
});

When('I invite someone to Peerio', async function() {
    return this.contactsHelper.inviteRandomEmailWithTemplate('peerio');
});

When('I invite a MedCryptor doctor', async function() {
    return this.contactsHelper.inviteRandomEmailWithTemplate('medcryptor-doctor');
});

When('I invite a MedCryptor patient', function() {
    return this.contactsHelper.inviteRandomEmailWithTemplate('medcryptor-patient');
});

Then('they receive Peerio templated email', async function() {
    return waitForEmail(this.invitedEmail, testConfig.inviteEmailSubject);
});

Then('they receive MedCryptor doctor templated email', async function() {
    return waitForEmail(this.invitedEmail, testConfig.inviteEmailSubjectMCDoctor);
});

Then('they receive MedCryptor patient templated email', async function() {
    return waitForEmail(this.invitedEmail, testConfig.inviteEmailSubjectMCPatient);
});

Then('Peerio invites default to Peerio templated email', async function() {
    await this.contactsHelper.inviteRandomEmail();
    await waitForEmail(this.invitedEmail, testConfig.inviteEmailSubject);
});

Then('MedCryptor invites default to doctor templated email', async function() {
    await this.contactsHelper.inviteRandomEmail();
    await waitForEmail(this.invitedEmail, testConfig.inviteEmailSubjectMCDoctor);
});
