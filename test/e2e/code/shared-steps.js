const { Given, When, Then } = require('cucumber');

// big timeouts on account creation and login due to scrypt being too heavy for CI container cpu
Given('I create my account', { timeout: 60000 }, async function() {
    await this.createAccount();
    if (this.cucumbotClient) this.cucumbotClient.sendReady();
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

When('Cucumbot logs in', { timeout: 60000 }, function() {
    return this.login();
});

Then('I am authenticated', function() {
    expect(this.ice.socket.authenticated).to.be.true;
});

Then('I am not authenticated', function() {
    expect(this.ice.socket.authenticated).to.be.false;
});

async function restart() {
    await this.app.restart();
    return this.login();
}

When('I restart', { timeout: 60000 }, restart);
When('Cucumbot restarts', { timeout: 60000 }, restart);

When('I restart without login', function() {
    return this.app.restart();
});


When('I send my credentials to Cucumbot', async function() {
    this.cucumbotClient.sendCredentials(this.username, this.passphrase);
});
