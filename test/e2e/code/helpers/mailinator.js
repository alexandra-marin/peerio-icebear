// const http = require('http');
// const https = require('https');

// const confirmLabel = 'Confirm your account';
// const newEmailLabel = 'confirm your new address';
// const invitedLabel = 'has invited you';

// function getMailbox() {
//     return new Promise((resolve) => {
//         const inbox =
// `http://api.mailinator.com/api/inbox?to=${process.env.PEERIO_ADMIN_EMAIL}
// &token=${process.env.MAILINATOR_KEY}`; // eslint-disable-line
//         http.get(inbox, (response) => {
//             let emails = '';
//             response.on('data', (chunk) => { emails += chunk; });
//             response.on('error', (e) => console.log(e.message));
//             response.on('end', () => {
//                 resolve(emails);
//             });
//         });
//     });
// }

// function addressedToUser(email, user) {
//     const containsName = email.subject.includes(user);
//     const containsText = email.subject.includes(confirmLabel) || email.subject.includes(newEmailLabel);

//     return containsName && containsText;
// }

// function isInviteEmail(email, user) {
//     const containsName = email.subject.includes(user);
//     const containsText = email.subject.includes(invitedLabel);

//     return containsName && containsText;
// };

// function getConfirmationEmailId(user, emails) {
//     const mailbox = JSON.parse(emails);
//     const confirmationEmailId = mailbox.messages
//         .find(email => addressedToUser(email, user))
//         .id;

//     return confirmationEmailId;
// };

// function getInviteEmailId(user, emails) {
//     const mailbox = JSON.parse(emails);
//     const confirmationEmailId = mailbox.messages
//         .find(email => isInviteEmail(email, user))
//         .id;

//     return confirmationEmailId;
// };

// function getConfirmationLink(body) {
//     const regex = /https:\\\/\\\/hocuspocus.peerio.com\\\/confirm-address\\\/\w*/ig;
//     let found = body.match(regex)[0];
//     found = found.replace(/\\\//g, '/');

//     return found;
// };

// function getConfirmationEmail(confirmationEmailId) {
//     return new Promise((resolve) => {
//         const emailUrl = `http://api.mailinator.com/api/email
// ?id=${confirmationEmailId}&token=${process.env.MAILINATOR_KEY}`; // eslint-disable-line

//         http.get(emailUrl, (res) => {
//             let body = '';
//             res.on('data', (chunk) => { body += chunk; });
//             res.on('error', (e) => console.log(e.message));
//             res.on('end', () => {
//                 const url = getConfirmationLink(body);
//                 resolve(url);
//             });
//         });
//     });
// };

// function openConfirmationLink(url) {
//     return new Promise((resolve) => {
//         https.get(url, (resp) => {
//             resp.on('data', () => { });
//             resp.on('error', (e) => console.log(e.message));
//             resp.on('end', () => resolve());
//         });
//     });
// };

// function confirmUserEmail(user) => {
//     return getMailbox()
//         .then(emails => {
//             const email = getConfirmationEmailId(user, emails);
//             return getConfirmationEmail(email)
//                 .then(url => openConfirmationLink(url));
//         });
// };

// function receivedEmailInvite(user) {
//     return new Promise((resolve, reject) => {
//         getMailbox()
//             .then(emails => {
//                 const email = getInviteEmailId(user, emails);
//                 if (email) {
//                     resolve();
//                 } else {
//                     reject();
//                 }
//             });
//     });
// };

// module.exports = { confirmUserEmail, receivedEmailInvite };
