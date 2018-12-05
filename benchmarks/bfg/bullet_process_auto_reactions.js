const { reaction, when } = require('mobx');

reaction(
    () => ice.chatInviteStore.received.length,
    () => {
        const invites = ice.chatInviteStore.received;
        if (invites.length > 0) ice.chatInviteStore.acceptInvite(invites[0].kegDbId);
    }
);

when(
    () => ice.chatStore.activeChat,
    () => {
        const sendMsg = () => {
            ice.chatStore.activeChat.sendMessage('Hello');
            setTimeout(sendMsg, 3000);
        };
        setTimeout(sendMsg, Math.random() * 10000);
    }
);
