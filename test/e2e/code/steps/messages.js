// const defineSupportCode = require('cucumber').defineSupportCode;
// const { when } = require('mobx');
// const { runFeatureForChatId, checkResult } = require('./helpers/runFeature');
// const client = require('./helpers/client');
// const { asPromise } = require('./../../../src/helpers/prombservable');
// const { getPropFromEnv } = require('./helpers/envHelper');
// const { otherUser } = require('./helpers/otherUser');
// const { testDocument, pathToUploadFrom } = require('./helpers/constants');

// defineSupportCode(({ Given, Then, When }) => {
//     const store = client.getChatStore();
//     let chatId;
//     const message = 'Hello world';
//     let numberOfMessages = -1;

//     const assignChatId = (id) => { chatId = id; };

//     const startChatWith = (user) => {
//         const chat = store.startChat([user]);

//         return asPromise(chat, 'added', true)
//             .delay(500)
//             .then(() => Promise.resolve(chat.id));
//     };

//     const loadChats = () => {
//         return store.loadAllChats()
//             .then(() => asPromise(store, 'loaded', true));
//     };

//     // Scenario: Create direct message
//     When('I create a direct message', () => {
//         return client.getContactWithName(otherUser.id)
//             .then(user => startChatWith(user).then(assignChatId));
//     });

//     Then('the receiver gets notified', () => {
//         return runFeatureForChatId('Receive chat request from account', otherUser.id, chatId)
//             .then(checkResult);
//     });

//     Then('a chat request pops up', () => {
//         chatId = getPropFromEnv('chatId');
//         return loadChats()
//             .then(() => {
//                 const found = store.chats.find(x => x.id === chatId);
//                 found.should.be.ok;
//             });
//     });

//     const indexOfCurrentChat = () => store.myChats.favorites.indexOf(store.activeChat);

//     When('I favorite a direct message conversation', () => {
//         const current = store.activeChat;
//         const added = store.myChats.addFavorite(current);

//         added.should.be.true;
//     });

//     Then('it appears on top of others', () => {
//         return loadChats()
//             .then(() => indexOfCurrentChat().should.be.equal(0));
//     });

//     When('I unfavorite a direct message conversation', () => {
//         const current = store.activeChat;
//         const removed = store.myChats.removeFavorite(current);
//         removed.should.be.true;
//     });

//     Then('it does not appear in my favorite conversations', () => {
//         return loadChats()
//             .then(() => indexOfCurrentChat().should.be.equal(-1));
//     });

//     Then('I send a direct message', (done) => {
//         numberOfMessages = store.activeChat.messages.length;
//         store.activeChat.sendMessage(message)
//             .catch(e => console.log(e))
//             .then(done);
//     });

//     Then('the message appears in the chat', () => {
//         return asPromise(store.activeChat.messages, 'length', numberOfMessages + 1);
//     });

//     Then('the receiver can read the message', () => {
//         return runFeatureForChatId('Receive new message from account', otherUser.id, chatId)
//             .then(checkResult);
//     });

//     Then('I can read my messages', () => {
//         return loadChats()
//             .then(() => {
//                 store.activeChat.messages
//                     .find(x => x.text === message)
//                     .should.be.ok;
//             });
//     });

//     Then('the receiver reads the message', () => {
//         return runFeatureForChatId('Read new message from account', otherUser.id, chatId)
//             .then(checkResult);
//     });

//     Then('I read my messages', () => {
//         client.showChatUI();
//         return loadChats()
//             .then(() => Promise.delay(2000));
//     });

//     Then('I view a read receipt', (done) => {
//         const chat = store.chats.find(x => x.id === chatId);
//         const found = chat.messages.find(x => x.text === message);
//         when(() => found.receipts, () => {
//             found.receipts.should.not.be.null;
//             found.receipts.length.should.be.equal(1);
//             done();
//         });
//     });

//     Given('I have never chatted with receiver before', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });

//     When('I enter a new chat', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     Then('there should be no history', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     Then('receiver should receive an invite', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     Given('I have chatted with receiver before', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });

//     When('I enter a new chat', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     Then('I should see our chat history', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });

//     Then('receiver should receive an invite', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     Given('I am in a chat with {string}', (callback) => {
//         // Write code here that turns the phrase above into concrete actions
//         callback(null, 'pending');
//     });


//     When('I upload and share a file in chat', () => {
//         return store.activeChat.uploadAndShareFile(pathToUploadFrom, testDocument);
//     });

//     Then('the receiver should see the file', () => {
//         return runFeatureForChatId('Receive new file from account', otherUser.id, chatId)
//             .then(checkResult);
//     });

//     Then('I can access file received in chat', (done) => {
//         loadChats().then(() => {
//             const fileStore = client.getFileStore();

//             const fileId = store.activeChat.messages[0].files[0];
//             return when(() => fileStore.loading === false, () => {
//                 const file = fileStore.getById(fileId);
//                 file.name.should.equal(testDocument);
//                 done();
//             });
//         });
//     });
// });
