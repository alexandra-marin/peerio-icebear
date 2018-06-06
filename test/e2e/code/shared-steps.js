const { Given, When, Then } = require('cucumber');

Given('I create my account', async function() {
    await this.createAccount();
    if (this.cucumbotClient) this.cucumbotClient.sendReady();
});

Given('I create a test account', function() {
    return this.createTestAccount();
});

Given('I create a test account and my account', async function() {
    await this.createTestAccount();
    await this.app.restart();
    return this.createAccount();
});

When('I login', function() {
    return this.login();
});

When('Cucumbot logs in', function() {
    return this.login();
});

Then('I am authenticated', function() {
    expect(ice.socket.authenticated).to.be.true;
});

Then('I am not authenticated', function() {
    expect(ice.socket.authenticated).to.be.false;
});

async function restart() {
    await this.app.restart();
    return this.login();
}

When('I restart', restart);
When('Cucumbot restarts', restart);

When('I restart without login', function() {
    return this.app.restart();
});

When('I send my credentials to Cucumbot', async function() {
    this.cucumbotClient.sendCredentials(this.username, this.passphrase);
});

When('I wait {int} seconds', function(int) {
    return Promise.delay(int * 1000);
});

When('I go offline', function() {
    ice.socket.close();
});

When('I go online', function() {
    ice.socket.open();
});
