// const defineSupportCode = require('cucumber').defineSupportCode;
// const { asPromise } = require('../../../src/helpers/prombservable');
// const { runFeatureFromUsername, checkResult } = require('./helpers/runFeature');
// const client = require('./helpers/client');
// const { otherUser } = require('./helpers/otherUser');
// const { testDocument, pathToUploadFrom, pathToDownloadTo } = require('./helpers/constants');
// const fs = require('fs');

// defineSupportCode(({ Then, When }) => {
//     const store = client.getFileStore();
//     const fileInStore = () => store.files.find(file => file.name === testDocument);
//     let numberOfFilesUploaded;

//     // Scenario: Upload
//     When('I upload a file', () => {
//         numberOfFilesUploaded = store.files.length;

//         const keg = store.upload(pathToUploadFrom);
//         return asPromise(keg, 'readyForDownload', true);
//     });

//     Then('I should see it in my files', () => {
//         store.files.length.should.be.equal(numberOfFilesUploaded + 1);
//         store.files.should.contain(x => x.name === testDocument);
//     });

//     // Scenario: Download
//     When('I download the file', (done) => {
//         fileInStore()
//             .download(pathToDownloadTo, false)
//             .then(done);
//     });

//     Then('I can access the file locally', (done) => {
//         fs.stat(pathToDownloadTo, (err) => {
//             if (err) {
//                 done(err, 'failed');
//             } else {
//                 fs.unlink(pathToDownloadTo, done);
//             }
//         });
//     });

//     // Scenario: Delete
//     Then('I delete the file', () => {
//         numberOfFilesUploaded = store.files.length;
//         return fileInStore().remove();
//     });

//     Then('it should be removed from my files', () => {
//         fileInStore().deleted.should.be.true;
//         return asPromise(store.files, 'length', numberOfFilesUploaded - 1);
//     });

//     // Scenario: Share
//     When('I share it with a receiver', () => {
//         return client.getContactWithName(otherUser.id)
//             .then(contact => {
//                 return fileInStore().share(contact);
//             });
//     });

//     Then('receiver should see it in their files', () => {
//         return runFeatureFromUsername('Access shared file', otherUser.id)
//             .then(checkResult);
//     });

//     Then('I should the shared file', () => {
//         store.files.should.contain(x => x.name === testDocument);
//     });

//     // Scenario: Delete after sharing
//     Then('it should be removed from receivers files', () => {
//         return runFeatureFromUsername('Deleted files', otherUser.id)
//             .then(checkResult);
//     });

//     Then('I should not see deleted files', () => {
//         store.files.should.not.contain(x => x.name === testDocument);
//     });
// });
