const { When, Then } = require('cucumber');
const { startDmWithCucumbot, sendMessage, findIncomingMessage } = require('./dm.helpers');

When('I start a DM with Cucumbot', startDmWithCucumbot);
When('Cucumbot starts a DM with me', startDmWithCucumbot);
When('I send a message {string}', sendMessage);
When('Cucumbot sends a message {string}', sendMessage);
Then('Cucumbot receives a message {string}', findIncomingMessage);
Then('I receive a message {string}', findIncomingMessage);

module.exports = { startDmWithCucumbot };
