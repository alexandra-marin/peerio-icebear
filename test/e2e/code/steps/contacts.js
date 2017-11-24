// const defineSupportCode = require('cucumber').defineSupportCode;
// const { receivedEmailInvite, confirmUserEmail } = require('./helpers/mailinatorHelper');
// const { runFeatureFromUsername, checkResult } = require('./helpers/runFeature');
// const { asPromise } = require('./../../../src/helpers/prombservable');
// const client = require('./helpers/client');
// const { otherUser } = require('./helpers/otherUser');

// defineSupportCode(({ Given, Then, When }) => {
//     const store = client.getContactStore();

//     const otherUserEmail = () => `${otherUser.id}@mailinator.com`;

//     let contactFromUsername;
//     const contactLoaded = () => {
//         contactFromUsername = store.getContact(otherUser.id);
//         return asPromise(contactFromUsername, 'loading', false).delay(500);
//     };

//     // Scenario: Find contact
//     Given(/I search for (?:a registered username|a registered email|an unregistered user)/, () => {
//         return contactLoaded();
//     });

//     When('the contact exists', () => {
//         contactFromUsername.notFound.should.be.false;
//     });

//     Then('the contact is added in my contacts', () => {
//         store.contacts.should.contain(c => c === contactFromUsername);
//     });


//     // Scenario: Send invite email
//     When('no profiles are found', () => {
//         contactFromUsername.notFound.should.be.true;
//     });

//     Then('they are added in my invited contacts', () => {
//         return contactLoaded()
//             .then(() => store.invitedContacts.should.contain(c => c === contactFromUsername));
//     });

//     Then('they should receive an email invitation', () => {
//         return receivedEmailInvite(otherUserEmail());
//     });


//     // Scenario: favorite a contact
//     When('I favorite a registered user', () => {
//         return store.addContact(otherUser.id)
//             .then(result => result.should.be.true);
//     });

//     Then('they will be in my favorite contacts', () => {
//         return contactLoaded()
//             .then(() => {
//                 return asPromise(contactFromUsername, 'isAdded', true)
//                     .then(() => store.addedContacts.should.contain(contactFromUsername));
//             });
//     });


//     // Scenario: Unfavorite a contact
//     When('I unfavorite them', () => {
//         store.removeContact(otherUser.id);
//     });

//     Then('they will not be in my favorites', () => {
//         return contactLoaded()
//             .then(() => store.addedContacts.should.not.contain(contactFromUsername));
//     });


//     // Scenario: Create favorite contact
//     When(/(?:I invite an unregistered user|I send an invitation to them)/, () => {
//         return store.invite(otherUserEmail());
//     });

//     When('they sign up', () => {
//         return runFeatureFromUsername('Create account with username', otherUser.id)
//             .then(checkResult);
//     });

//     When('they confirm their email', () => {
//         return confirmUserEmail(otherUserEmail());
//     });


//     // Scenario: Remove favorite contact before email confirmation
//     When('I remove the invitation', () => {
//         return store.removeInvite(otherUserEmail());
//     });
// });
