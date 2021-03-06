export async function startDmWithCucumbot() {
    const contact = ice.contactStore.getContact(
        (this.cucumbotClient || this.cucumbotServer).username
    );
    await contact.ensureLoaded();
    const chat = await ice.chatStore.startChat([contact]);
    await this.waitFor(
        () =>
            ice.chatStore.activeChat &&
            ice.chatStore.activeChat.id === chat.id &&
            ice.chatStore.activeChat.metaLoaded
    );
    chat.id.should.be.equal(ice.chatStore.activeChat.id);
}

export async function sendMessage(string) {
    await this.waitFor(() => ice.chatStore.activeChat && ice.chatStore.activeChat.metaLoaded);
    return ice.chatStore.activeChat.sendMessage(string);
}

export function findIncomingMessage(string) {
    return this.waitFor(() => {
        if (!ice.chatStore.activeChat) return false;
        const msg = ice.chatStore.activeChat.messages.find(
            m => m.text === string && m.sender.username !== this.username
        );

        return !!msg;
    });
}
export function findAnyMessage(string) {
    return this.waitFor(() => {
        if (!ice.chatStore.activeChat) return false;
        const msg = ice.chatStore.activeChat.messages.find(m => m.text === string);
        return !!msg;
    });
}
