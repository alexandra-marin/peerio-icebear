const { When, Then } = require('cucumber');
const { startDmWithCucumbot, sendMessage, findIncomingMessage, findAnyMessage } = require('./dm.helpers');

When('I start a DM with Cucumbot', { timeout: 40000 }, startDmWithCucumbot);
When('Cucumbot starts a DM with me', { timeout: 40000 }, startDmWithCucumbot);
When('I send a message {string}', { timeout: 40000 }, sendMessage);
When('Cucumbot sends a message {string}', { timeout: 40000 }, sendMessage);
Then('Cucumbot receives a message {string}', { timeout: 40000 }, findIncomingMessage);
Then('Cucumbot receives own message {string}', { timeout: 40000 }, findAnyMessage);
Then('I receive a message {string}', { timeout: 40000 }, findIncomingMessage);
Then('I receive own message {string}', { timeout: 40000 }, findAnyMessage);

module.exports = { startDmWithCucumbot };
