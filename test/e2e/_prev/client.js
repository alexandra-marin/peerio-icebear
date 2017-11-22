// const getAppInstance = require('./appConfig');
// const { asPromise } = require('../../../../src/helpers/prombservable');
// const { when } = require('mobx');

// class Client {
//     app = getAppInstance();

//     get currentUser() { return this.app.User.current; }
//     waitForConnection = () => asPromise(this.app.socket, 'connected', true);
//     waitForAuth = () => asPromise(this.app.socket, 'authenticated', true);
//     getContactStore = () => this.app.contactStore;
//     getChatStore = () => this.app.chatStore;
//     getChatInviteStore = () => this.app.chatInviteStore;
//     getFileStore = () => this.app.fileStore;

//     setCurrentUser = (username, passphrase) => {
//         this.app.User.current = new this.app.User();
//         this.app.User.current.username = username;
//         this.app.User.current.passphrase = passphrase;
//         this.app.User.current.email = `${username}@mailinator.com`;

//         return this.app.User.current;
//     };

//     getContactWithName = (name) => {
//         return new Promise((resolve) => {
//             const receiver = new this.app.Contact(name);
//             when(() => !receiver.loading, () => resolve(receiver));
//         });
//     };

//     showChatUI = () => {
//         this.app.clientApp.isFocused = true;
//         this.app.clientApp.isInChatsView = true;
//     };
// }

// module.exports = new Client();
