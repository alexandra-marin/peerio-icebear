const defineSupportCode = require('cucumber').defineSupportCode;
const { when } = require('mobx');
const { asPromise } = require('../../../src/helpers/prombservable');
const { runFeatureForChatId, checkResult } = require('./helpers/runFeature');
const { getPropFromEnv } = require('./helpers/envHelper');
const { getChatStore, getChatInviteStore, currentUser } = require('./client');
const { otherUser } = require('./helpers/otherUser');

defineSupportCode(({ Then, When }) => {
    const chatStore = getChatStore();
    const inviteStore = getChatInviteStore();

    const roomName = 'test-room';
    const roomPurpose = 'test-room';

    let room;

    // Scenario: Create room
    When('I create a room', (done) => {
        console.log(`Channels left: ${currentUser().channelsLeft}`);

        room = chatStore.startChat([], true, roomName, roomPurpose);
        when(() => room.added === true, done);
    });

    Then('I can rename the room', () => {
        const newChatName = 'superhero-hq';
        room.rename(newChatName);

        return asPromise(room, 'name', newChatName);
    });

    Then('I can change the room purpose', () => {
        const newChatPurpose = 'discuss superhero business';
        room.changePurpose(newChatPurpose);

        return asPromise(room, 'purpose', newChatPurpose);
    });


    // Scenario: Delete room
    Then('I can delete a room', () => {
        const numberOfChats = chatStore.chats.length;
        return room.delete()
            .then(() => {
                when(() => chatStore.chats.length === numberOfChats - 1, () => {
                    const roomExists = chatStore.chats.includes(x => x === room);
                    roomExists.should.be.false;
                });
            });
    });


    // Scenario: Send invite
    When('I invite another user', () => {
        return room.addParticipants([otherUser.id]);
    });

    Then('they should get a room invite', () => {
        return runFeatureForChatId('Receive room invite', otherUser.id, room.id)
            .then(checkResult);
    });

    Then('I receive a room invite', (done) => {
        const chatId = getPropFromEnv('chatId');
        when(() => inviteStore.received.length, () => {
            const found = inviteStore.received.find(x => x.kegDbId === chatId);
            found.should.be.ok;
            done();
        });
    });


    // Scenario: Kick member
    When('someone has joined the room', { timeout: 20000 }, () => {
        return room.addParticipants([otherUser.id])
            .then(() => {
                return runFeatureForChatId('Accept room invite', otherUser.id, room.id)
                    .then(checkResult);
            });
    });

    Then('I accept a room invite', (cb) => {
        const chatId = getPropFromEnv('chatId');

        when(() => inviteStore.received.length, () => {
            const found = inviteStore.received.find(x => x.kegDbId === chatId);
            found.should.be.ok;

            inviteStore.acceptInvite(chatId).then(cb);
        });
    });

    Then('I them kick out', (done) => {
        const participants = room.joinedParticipants.length;
        room.removeParticipant(otherUser.id);

        when(() => room.joinedParticipants.length === participants - 1, done);
    });

    Then('they should not be in the room anymore', () => {
        const exists = room.joinedParticipants.includes(x => x.username === otherUser.id);
        exists.should.false;
    });


    // Scenario: Promote member
    When('I can promote them to admin', () => {
        const admin = room.joinedParticipants.find(x => x.username === otherUser.id);
        return room.promoteToAdmin(admin);
    });


    // Scenario: Demote member
    Then('I can demote them as admin', () => {
        const admin = room.joinedParticipants.find(x => x.username === otherUser.id);
        return room.demoteAdmin(admin);
    });


    // Scenario: Can not create more than 3 rooms
    When('I created 3 rooms', () => {
        // const invited = new app.Contact(otherUser.id, {}, true);
        // console.log(currentUser().channelsLeft); // 0

        // room = chatStore.startChat([invited], true, roomName, roomPurpose);
        // console.log(room); // TypeError: Cannot read property 'added' of null
    });
});