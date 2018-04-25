async function startDmWithCucumbot() {
    const contact = ice.contactStore.getContact((this.cucumbotClient || this.cucumbotServer).username);
    await contact.ensureLoaded();
    const chat = ice.chatStore.startChat([contact]);
    await this.waitFor(() => ice.chatStore.activeChat
        && ice.chatStore.activeChat.id === chat.id
        && ice.chatStore.activeChat.metaLoaded
        && ice.chatStore.activeChat.headLoaded);
    chat.id.should.be.equal(ice.chatStore.activeChat.id);
}

async function sendMessage(string) {
    await this.waitFor(() => ice.chatStore.activeChat && ice.chatStore.activeChat.metaLoaded);
    return ice.chatStore.activeChat.sendMessage(string);
}

function findIncomingMessage(string) {
    return this.waitFor(
        () => {
            if (!ice.chatStore.activeChat) return false;
            const msg = ice.chatStore.activeChat.messages
                .find(m => m.text === string && m.sender.username !== this.username);

            return !!msg;
        }
    );
}
function findAnyMessage(string) {
    return this.waitFor(
        () => {
            if (!ice.chatStore.activeChat) return false;
            const msg = ice.chatStore.activeChat.messages
                .find(m => m.text === string);
            return !!msg;
        }
    );
}

module.exports = { startDmWithCucumbot, sendMessage, findIncomingMessage, findAnyMessage };
