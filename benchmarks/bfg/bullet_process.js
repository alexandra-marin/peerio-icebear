/**
 * This is an entry point to the instance of Peerio app we are simulating.
 */
const { when } = require('mobx');

// never exit
setInterval(() => {}, 5000);

// configure all the stuff, sdk, start socket, create account, login, get ready to work
require('./bullet_process_init');

// we want client to implicitly perform some reactions like accepting room invite
require('./bullet_process_auto_reactions');

const { ipcSend } = require('./bullet_process_helpers');

process.on('message', async msg => {
    switch (msg.type) {
        case 'rce':
            eval(msg.data.code);
            break;
        case 'startChat': {
            const contacts = ice.contactStore.getContacts(msg.data.usernames);
            ice.chatStore.startChat(contacts, true, 'bfgroom');
            break;
        }
        case 'setAdmins': {
            when(
                () =>
                    ice.chatStore.activeChat &&
                    ice.chatStore.activeChat.metaLoaded &&
                    msg.data.usernames.every(u =>
                        ice.chatStore.activeChat.allParticipants.find(p => p.username === u)
                    ),
                () => {
                    const contacts = ice.contactStore.getContacts(msg.data.usernames);
                    Promise.each(contacts, c => ice.chatStore.activeChat.promoteToAdmin(c));
                }
            );
            break;
        }
        default:
            console.error(`Unknown message type ${msg.type}`);
    }
});

global.logTelemetry = () => {
    const messages = ice.chatStore.activeChat.messages;
    if (messages.length < 1) return;
    ipcSend('log', { message: `### Telemetry event ${Date.now()}` });
    ipcSend('log', {
        message: `max message id: ${messages[messages.length - 1].id} `
    });
    const diff = messages[messages.length - 1].id - messages[0].id + 1;
    ipcSend('log', {
        message: `message gap size: ${diff - messages.length} `
    });
};
