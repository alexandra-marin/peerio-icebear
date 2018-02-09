const { Given, When, Then } = require('cucumber');

// big timeouts on account creation and login due to scrypt being too heavy for CI container cpu
Given('I create my account', { timeout: 60000 }, function() {
    return this.createAccount();
});

Given('I create a test account', { timeout: 60000 }, function() {
    return this.createTestAccount();
});

Given('I create a test account and my account', { timeout: 120000 }, async function() {
    await this.createTestAccount();
    await this.app.restart();
    return this.createAccount();
});

When('I login', { timeout: 60000 }, function() {
    return this.login();
});

Then('I am authenticated', function() {
    expect(this.ice.socket.authenticated).to.be.true;
});

Then('I am not authenticated', function() {
    expect(this.ice.socket.authenticated).to.be.false;
});

When('I restart', { timeout: 60000 }, async function() {
    await this.app.restart();
    return this.login();
});

When('I restart without login', function() {
    return this.app.restart();
});

