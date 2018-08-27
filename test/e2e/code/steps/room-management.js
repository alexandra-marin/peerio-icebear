const { When, Then } = require('cucumber');

function isInvitedMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        const { allParticipants, allJoinedParticipants } = chat;
        return allParticipants.find(predicate) && !allJoinedParticipants.find(predicate);
    });
}

function isJoinedMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        const { allParticipants, allJoinedParticipants } = chat;
        return allParticipants.find(predicate) && allJoinedParticipants.find(predicate);
    });
}

function isNotAMember(world, chat, username) {
    const predicate = p => p.username === username;
    return world.waitFor(() => {
        return !chat.allParticipants.find(predicate);
    });
}
async function createRoom() {
    const room = await ice.chatStore.startChat([], true);
    return this.waitFor(() => room.metaLoaded && ice.chatStore.activeChat);
}

When('I create a room', createRoom);

function inviteCucumbot() {
    this.chatKeyCountWhenInviting = Object.keys(ice.chatStore.activeChat.db.boot.keys).length;
    return ice.chatStore.activeChat.addParticipants([this.cucumbotClient.username]);
}

When('I invite Cucumbot to the room', inviteCucumbot);

When('Cucumbot leaves the room', async function() {
    await this.waitFor(() => ice.chatStore.activeChat);
    return ice.chatStore.activeChat.leave();
});

async function cucumbotAccept() {
    await this.waitFor(() => ice.chatInviteStore.received.length);
    return ice.chatInviteStore.acceptInvite(ice.chatInviteStore.received[0].kegDbId);
}

When('Cucumbot accepts the invite', cucumbotAccept);

When('Cucumbot rejects the invite', function() {
    return ice.chatInviteStore.rejectInvite(ice.chatInviteStore.received[0].kegDbId);
});

When('I recall the invite', function() {
    return ice.chatInviteStore.revokeInvite(
        ice.chatStore.activeChat.id,
        this.cucumbotClient.username
    );
});

When('I kick Cucumbot from the room', function() {
    return ice.chatStore.activeChat.removeParticipant(this.cucumbotClient.username);
});

Then('The room is rekeyed', function() {
    return (
        Object.keys(ice.chatStore.activeChat.db.boot.keys).length > this.chatKeyCountWhenInviting
    );
});

Then('I see the invite I sent', async function() {
    await this.waitFor(() =>
        ice.chatStore.activeChat.messages.find(m => {
            const sd = m.systemData;
            return (
                sd &&
                sd.action === 'inviteSent' &&
                sd.usernames.length === 1 &&
                sd.usernames[0] === this.cucumbotClient.username
            );
        })
    );
    await this.waitFor(() => {
        const invites = ice.chatInviteStore.sent.get(ice.chatStore.activeChat.id);
        return (
            invites && invites.length === 1 && invites[0].username === this.cucumbotClient.username
        );
    });
    return isInvitedMember(this, ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('I can see Cucumbot joined the room', async function() {
    await this.waitFor(() => ice.chatInviteStore.sent.keys.length === 0);
    return isJoinedMember(this, ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('Cucumbot has joined the room', async function() {
    await this.waitFor(() => ice.chatInviteStore.received.length === 0);
    await this.waitFor(() => ice.chatStore.activeChat && ice.chatStore.activeChat.metaLoaded);
    return isJoinedMember(this, ice.chatStore.activeChat, this.username);
});

Then('Cucumbot receives the invite', function() {
    return this.waitFor(() => {
        const invites = ice.chatInviteStore.received;
        return invites.length === 1 && invites[0].username === this.cucumbotServer.username;
    });
});

Then('The invite sent is removed', function() {
    return this.waitFor(() => ice.chatInviteStore.sent.keys.length === 0);
});

Then("Cucumbot's invite is removed", function() {
    return this.waitFor(() => ice.chatInviteStore.received.length === 0);
});

Then('The Cucumbot is not a member of the room', function() {
    return isNotAMember(this, ice.chatStore.activeChat, this.cucumbotClient.username);
});

Then('Cucumbot is not in the room anymore', function() {
    return this.waitFor(() => !ice.chatStore.activeChat && ice.chatStore.channels.length === 0);
});

When('I create a room with Cucumbot', async function() {
    await createRoom.call(this);
    return inviteCucumbot.call(this);
});
