const { defineSupportCode } = require('cucumber');
const { waitForEmail, deleteEmail } = require('../helpers/maildrop');
const { getUrl } = require('../helpers/https');
const { getRandomEmail } = require('../helpers/random-data');
const testConfig = require('../test-config');


defineSupportCode(({ Given, When, Then }) => {
    When('I change my first name to {string}', function(string) {
        this.ice.User.current.firstName = string;
        return this.ice.User.current.saveProfile();
    });

    When('I change my last name to {string}', function(string) {
        this.ice.User.current.lastName = string;
        return this.ice.User.current.saveProfile();
    });

    Then('my first name should be {string}', function(string) {
        this.ice.User.current.firstName.should.equal(string);
    });

    Then('my last name should be {string}', function(string) {
        this.ice.User.current.lastName.should.equal(string);
    });

    When('I add a new email', async function() {
        this.lastAddedEmail = getRandomEmail();
        await this.ice.User.current.addEmail(this.lastAddedEmail);
    });

    // This IS very similar to confirming primary email address in account.js
    // but trying to merge these two into one universal step just makes things messy for not much benefit
    When('I confirm my new email', { timeout: 45000 }, async function() {
        const email = await waitForEmail(this.lastAddedEmail, testConfig.newEmailConfirmSubject);
        const url = testConfig.emailConfirmUrlRegex.exec(email.body)[1];
        await getUrl(url);
        // giving confirmed status a chance to propagate
        return this.waitForObservable(() => {
            const adr = this.ice.User.current.addresses.find(a => a.address === this.lastAddedEmail);
            if (!adr) return false;
            return adr.confirmed;
        }, 5000);
    });

    Then('my new email is confirmed', function() {
        const adr = this.ice.User.current.addresses.find(a => a.address === this.lastAddedEmail);
        expect(adr.confirmed).to.be.true;
    });

    Given('I delete confirmation email', { timeout: 45000 }, async function() {
        const email = await waitForEmail(this.lastAddedEmail, testConfig.newEmailConfirmSubject);
        return deleteEmail(this.lastAddedEmail, email.id);
    });

    When('I request confirmation email resend', function() {
        return this.ice.User.current.resendEmailConfirmation(this.lastAddedEmail);
    });

    When('I change my primary email', function() {
        return this.ice.User.current.makeEmailPrimary(this.lastAddedEmail);
    });

    Then('my primary email has been changed', { timeout: 15000 }, function() {
        return this.waitForObservable(() => {
            return this.ice.User.current.email === this.lastAddedEmail;
        }, 5000);
    });
});

