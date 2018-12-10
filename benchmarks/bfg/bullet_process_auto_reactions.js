const { reaction, when } = require('mobx');
const faker = require('faker');
const { getRandomNumber } = require('../../dist/crypto/util/random');
const { MIN_MSG_INTERVAL, MAX_MSG_INTERVAL } = require('./config');

reaction(
    () => ice.chatInviteStore.received.length,
    () => {
        const invites = ice.chatInviteStore.received;
        if (invites.length > 0)
            setTimeout(
                () => ice.chatInviteStore.acceptInvite(invites[0].kegDbId),
                getRandomNumber(MIN_MSG_INTERVAL, MAX_MSG_INTERVAL)
            );
    }
);
let msgid = 0;
when(
    () => ice.chatStore.activeChat,
    () => {
        const sendMsg = () => {
            ice.chatStore.activeChat.sendMessage(`${msgid++} ${faker.hacker.phrase()}`);
            setTimeout(sendMsg, getRandomNumber(MIN_MSG_INTERVAL, MAX_MSG_INTERVAL));
        };
        setTimeout(sendMsg, getRandomNumber(MIN_MSG_INTERVAL, MAX_MSG_INTERVAL));
    }
);
