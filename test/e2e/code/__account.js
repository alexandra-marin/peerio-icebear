// const defineSupportCode = require('cucumber').defineSupportCode;
// const { when } = require('mobx');
// const { getRandomUsername } = require('./helpers/usernameHelper');
// const { confirmUserEmail } = require('./helpers/mailinatorHelper');
// const { DisconnectedError } = require('./../../../src/errors');
// const { asPromise } = require('../../../src/helpers/prombservable');
// const client = require('./helpers/client');
// const { secretPassphrase } = require('./helpers/constants');

// defineSupportCode(({ Before, Given, Then, When }) => {
//     let secret = null;
//     let blob = null;
//     let url = '';
//     let newEmail;

//     let username, passphrase;

//     const notifyOfCredentials = () => {
//         const data = {
//             username: client.currentUser.username,
//             passphrase: client.currentUser.passphrase
//         };
//         console.log(`<peerioData>${JSON.stringify(data)}</peerioData>`);
//     };

//     const setCredentialsIfAny = () => {
//         if (process.env.peerioData) {
//             const data = JSON.parse(process.env.peerioData);
//             ({ username, passphrase } = data);
//         }
//     };

//     Before(() => {
//         return client.waitForConnection()
//             .then(setCredentialsIfAny);
//     });

//     Before('not @subScenario', (testCase, done) => {
//         username = getRandomUsername();
//         passphrase = secretPassphrase;
//         client.setCurrentUser(username, passphrase);

//         client.currentUser
//             .createAccountAndLogin()
//             .then(() => asPromise(client.currentUser, 'profileLoaded', true))
//             .then(() => when(() => client.currentUser.quota, done));
//     });

//     Given('I am logged in', (done) => {
//         client.setCurrentUser(username, passphrase);
//         client.currentUser.login()
//             .then(() => asPromise(client.currentUser, 'profileLoaded', true))
//             .then(() => when(() => client.currentUser.quota, done));
//     });


//     // Scenario: Account creation
//     Given('I am a new customer', () => {
//         client.setCurrentUser(getRandomUsername(), secretPassphrase);
//     });

//     When('I successfully create a new account', () => {
//         return client.currentUser.createAccountAndLogin()
//             .should.be.fulfilled
//             .then(notifyOfCredentials);
//     });

//     Then('I will be logged in', () => {
//         return client.waitForAuth();
//     });


//     // Scenario: Account deletion
//     When('my email is confirmed', () => {
//         return confirmUserEmail(`${username}@mailinator.com`)
//             .then(() => {
//                 client.currentUser.primaryAddressConfirmed = true;
//             });
//     });

//     Given('I delete my account', () => {
//         return client.currentUser.deleteAccount(client.currentUser.username);
//     });

//     Then('I should not be able to login', () => {
//         return client.currentUser
//             .login()
//             .should.be.rejectedWith(DisconnectedError);
//     });


//     // Scenario: Sign in
//     Given('I am a returning customer', () => {
//         client.setCurrentUser(username, passphrase);
//     });

//     When('I sign in', () => {
//         return client.currentUser.login()
//             .should.be.fulfilled;
//     });

//     Then('I have access to my account', () => {
//         return client.waitForAuth();
//     });


//     // Scenario: Sign out
//     When('I sign out', () => {
//         return client.currentUser.signout(); // isserverWarning_emailConfirmationSent
//     });

//     Then('I can not access my account', (done) => {
//         done(null, 'pending'); // check 2fa
//     });


//     // Scenario: Primary email
//     When('I add a new email', () => {
//         newEmail = `${getRandomUsername()}@mailinator.com`;
//         return client.currentUser.addEmail(newEmail);
//     });

//     When('the new email is confirmed', () => {
//         return confirmUserEmail(newEmail);
//     });

//     When('I make the new email primary', () => {
//         return client.currentUser.makeEmailPrimary(newEmail);
//     });

//     Then('the primary email should be updated', () => {
//         return client.currentUser.login()
//             .then(() => {
//                 const primaryAddress = client.currentUser.addresses.find(x => x.primary);
//                 primaryAddress.should.not.be.null.and.equal(newEmail);
//             });
//     });


//     // Scenario: Add new email
//     Then('new email is in my addresses', () => {
//         client.currentUser.addresses
//             .find(x => x.address === newEmail)
//             .should.not.be.null;
//     });


//     // Scenario: Remove email
//     When('I remove the new email', () => {
//         return client.currentUser.removeEmail(newEmail);
//     });

//     Then('the new email should not appear in my addresses', () => {
//         client.currentUser.addresses
//             .includes(x => x.address === newEmail)
//             .should.be.false;
//     });


//     // Scenario: Update display name
//     When('I change my display name', () => {
//         client.currentUser.firstName = 'Alice';
//         client.currentUser.lastName = 'Carroll';

//         return client.currentUser.saveProfile();
//     });

//     Then('it should be updated', () => {
//         client.currentUser.firstName.should.equal('Alice');
//         client.currentUser.lastName.should.equal('Carroll');
//     });


//     // Scenario: Add avatar successfully
//     When('I upload an avatar', () => {
//         blob = [new ArrayBuffer(42), new ArrayBuffer(42)];

//         return client.currentUser.saveAvatar(blob)
//             .should.be.fulfilled;
//     });

//     Then('it should appear in my profile', () => {
//         return client.getContactWithName(client.currentUser.username)
//             .then(user => user.hasAvatar.should.be.true);
//     });


//     // Scenario: Add avatar when another one is being loaded
//     When('another avatar upload is in progress', () => {
//         client.currentUser.savingAvatar = true;
//         blob = null;
//     });

//     Then('I should get an error saying {err}', (err) => {
//         return client.currentUser.saveAvatar(blob)
//             .should.be.rejectedWith(err);
//     });


//     // Scenario: Add avatar with wrong number of pictures
//     When('the upload does not contain 2 blobs', () => {
//         blob = { small: '' };
//     });


//     // Scenario: Add avatar with malformed payload
//     When('the payload is malformed', () => {
//         blob = ['', ''];
//     });


//     // Scenario: Update avatar
//     Given('I have an avatar', () => {
//         blob = [new ArrayBuffer(42), new ArrayBuffer(42)];

//         return client.currentUser.saveAvatar(blob)
//             .should.be.fulfilled
//             .then(() => {
//                 const contact = client.getContactStore().getContact(username);
//                 url = contact.profileVersion;
//             });
//     });

//     When('I upload a new avatar', () => {
//         blob = [new ArrayBuffer(43), new ArrayBuffer(43)];

//         return client.currentUser.saveAvatar(blob)
//             .should.be.fulfilled;
//     });

//     Then('the new avatar should be displayed', () => {
//         const contact = client.getContactStore().getContact(username);
//         contact.profileVersion.should.be.equal(url + 1);
//     });


//     //  Scenario: Remove avatar
//     When('I delete my avatar', () => {
//         blob = null;

//         return client.currentUser.saveAvatar(blob)
//             .should.be.fulfilled;
//     });

//     Then('my avatar should be empty', () => {
//         return client.getContactWithName(client.currentUser.username)
//             .then(user => user.hasAvatar.should.be.false);
//     });


//     // Scenario: Enable 2FA
//     When('I enable 2FA', (done) => {
//         client.currentUser.twoFAEnabled = false;

//         client.currentUser
//             .setup2fa()
//             .then((s) => { secret = s; })
//             .then(done);
//     });

//     Then('I should receive a challenge', () => {
//         secret.should.not.be.null;

//         // const token = speakeasy.totp({
//         //     secret: secret.base32,
//         //     encoding: 'base32'
//         // });
//         // console.log(`secret is: ${token}`);

//         // app.clientApp
//         //     .active2FARequest
//         //     .submit(token, false);

//         // app.User.current.confirm2faSetup(token, false)
//         //     .then(done);
//     });


//     // Scenario: Try to enable 2FA when it's already active
//     When('2FA is already enabled', () => {
//         client.currentUser.twoFAEnabled = true;
//     });

//     Then('I should receive an error saying {string}', (err) => {
//         return client.currentUser
//             .setup2fa()
//             .should.be.rejectedWith(err);
//     });


//     // Scenario: Disable 2FA
//     Then('I can disable 2FA', (done) => {
//         done(null, 'pending');
//         // First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object
//         // app.User.current
//         //     .disable2fa()
//         //     .then(() => {
//         //         app.User.current.twoFAEnabled.should.be.true;
//         //     })
//         //     .then(done);
//     });

//     // Helpers
//     Then('Create account with username', (done) => {
//         if (process.env.peerioData) {
//             const data = JSON.parse(process.env.peerioData);
//             username = data.username;
//         } else {
//             done(null, 'failed');
//         }

//         client.setCurrentUser(username, secretPassphrase);
//         client.currentUser.createAccountAndLogin()
//             .should.be.fulfilled
//             .then(done);
//     });

//     Given('Create new account', () => {
//         client.setCurrentUser(getRandomUsername(), secretPassphrase);
//         return client.currentUser
//             .createAccountAndLogin()
//             .should.be.fulfilled
//             .then(notifyOfCredentials);
//     });
// });
