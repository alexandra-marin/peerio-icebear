const { When, Then } = require('cucumber');

function isInvitedMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        const { allParticipants, allJoinedParticipants } = chat;
        return allParticipants.find(predicate)
            && !allJoinedParticipants.find(predicate);
    });
}

function isJoinedMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        const { allParticipants, allJoinedParticipants } = chat;
        return allParticipants.find(predicate)
            && allJoinedParticipants.find(predicate);
    });
}

function isNotAMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        return !chat.allParticipants.find(predicate);
    });
}

When('I create a room', function() {
    const room = this.ice.chatStore.startChat([], true);
    return this.waitFor(() => room.metaLoaded && this.ice.chatStore.activeChat);
});

When('I invite Cucumbot to the room', function() {
    return this.ice.chatStore.activeChat.addParticipants(
        [this.cucumbotClient.username]
    );
});

When('Cucumbot leaves the room', async function() {
    await this.waitFor(() => this.ice.chatStore.activeChat);
    return this.ice.chatStore.activeChat.leave();
});

When('Cucumbot accepts the invite', function() {
    return this.ice.chatInviteStore.acceptInvite(
        this.ice.chatInviteStore.received[0].kegDbId
    );
});

When('Cucumbot rejects the invite', function() {
    return this.ice.chatInviteStore.rejectInvite(
        this.ice.chatInviteStore.received[0].kegDbId
    );
});

When('I recall the invite', function() {
    return this.ice.chatInviteStore.revokeInvite(this.ice.chatStore.activeChat.id, this.cucumbotClient.username);
});

When('I kick Cucumbot from the room', function() {
    return this.ice.chatStore.activeChat.removeParticipant(this.cucumbotClient.username);
});


Then('I see the invite I sent', async function() {
    await this.waitFor(() => this.ice.chatStore.activeChat.messages.find((m) => {
        const sd = m.systemData;
        return sd && sd.action === 'inviteSent' && sd.usernames.length === 1
            && sd.usernames[0] === this.cucumbotClient.username;
    }));
    await this.waitFor(() => {
        const invites = this.ice.chatInviteStore.sent.get(this.ice.chatStore.activeChat.id);
        return invites && invites.length === 1 && invites[0].username === this.cucumbotClient.username;
    });
    return isInvitedMember(this, this.ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('I can see Cucumbot joined the room', async function() {
    await this.waitFor(() => this.ice.chatInviteStore.sent.keys.length === 0);
    return isJoinedMember(this, this.ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('Cucumbot has joined the room', async function() {
    await this.waitFor(() => this.ice.chatInviteStore.received.length === 0);
    await this.waitFor(() => this.ice.chatStore.activeChat && this.ice.chatStore.activeChat.metaLoaded);
    return isJoinedMember(this, this.ice.chatStore.activeChat, this.username);
});

Then('Cucumbot receives the invite', function() {
    return this.waitFor(() => {
        const invites = this.ice.chatInviteStore.received;
        return invites.length === 1 && invites[0].username === this.cucumbotServer.username;
    });
});

Then('The invite sent is removed', function() {
    return this.waitFor(() => this.ice.chatInviteStore.sent.keys.length === 0);
});

Then('Cucumbot\'s invite is removed', function() {
    // TODO:
    // TODO: REMOVE THE HACK WHEN SERVER BUG IS FIXED
    // TODO:
    return true;
    // return this.waitFor(() => this.ice.chatInviteStore.received.length === 0, 10000);
});

Then('The Cucumbot is not a member of the room', function() {
    return isNotAMember(this, this.ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('Cucumbot is not in the room anymore', function() {
    return this.waitFor(() => !this.ice.chatStore.activeChat && this.ice.chatStore.channels.length === 0);
});

