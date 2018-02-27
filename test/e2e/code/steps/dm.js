const { When, Then } = require('cucumber');

async function startDm() {
    const contact = this.ice.contactStore.getContact((this.cucumbotClient || this.cucumbotServer).username);
    await contact.ensureLoaded();
    const chat = this.ice.chatStore.startChat([contact]);
    await this.waitFor(() => !!this.ice.chatStore.activeChat);
    chat.id.should.be.equal(this.ice.chatStore.activeChat.id);
}
When('I start a DM with Cucumbot', startDm);
When('Cucumbot starts a DM with me', startDm);

// -----------------------

async function sendMessage(string) {
    await this.waitFor(() => this.ice.chatStore.activeChat && this.ice.chatStore.activeChat.metaLoaded);
    return this.ice.chatStore.activeChat.sendMessage(string);
}
When('I send a message {string}', sendMessage);
When('Cucumbot sends a message {string}', sendMessage);

// -----------------------

function findIncomingMessage(string) {
    return this.waitFor(
        () => {
            return this.ice.chatStore.activeChat
                && this.ice.chatStore.activeChat.messages
                    .find(m => m.text === string && m.sender.username !== this.username);
        }
    );
}
Then('Cucumbot receives a message {string}', findIncomingMessage);
Then('I receive a message {string}', findIncomingMessage);

