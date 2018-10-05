// todo: this needs to be redone to test tiny db modules separately
// const util = require('../util');
// const StorageEngine = require('~/models/storage/node-json-storage');

// // this is a sequenced test suite
// describe('TinyDB', () => {
//     let key, username;

//     before(() => {
//         StorageEngine.storageFolder = './tinydbtemp';

//         const db = require('../../../src/db/tiny-db');
//         const keys = require('../../../src/crypto/keys');
//         key = keys.generateEncryptionKey();
//         username = util.getRandomUsername();
//         // system db is expected to open without explicit call
//         db.system.should.exist;
//     });

//     function execForEachDb(testFn) {
//         const db = require('../../../src/db/tiny-db');
//         return Promise.all([db.system, db.user].map(testFn));
//     }

//     beforeEach(() => {
//         const db = require('../../../src/db/tiny-db');
//         db.openSystem();
//         db.openUser(username, key);
//         return execForEachDb(d => d.clear())
//             .then(() => {
//                 db.openSystem();
//                 db.openUser(username, key);
//             });
//     });

//     it('Create and read a value', () => {
//         const vkey = 'test';
//         const expected = 10;
//         return execForEachDb(d =>
//             d.setValue(vkey, expected)
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expected.should.equal(actual))
//         );
//     });

//     it('Read inexisting value', () => {
//         const vkey = 'this_key_does_not_exist';
//         return execForEachDb(d => d.getValue(vkey).then(actual => expect(actual).to.be.null));
//     });

//     it('Edit a value', () => {
//         const vkey = 'test';
//         const expected = 10;
//         const expected2 = 20;
//         return execForEachDb(d =>
//             d.setValue(vkey, expected)
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expected.should.equal(actual))
//                 .then(() => d.setValue(vkey, expected2))
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expected2.should.equal(actual))
//         );
//     });

//     it('Remove a value', () => {
//         const vkey = 'test';
//         const expected = 10;
//         return execForEachDb(d =>
//             d.setValue(vkey, expected)
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expected.should.equal(actual))
//                 .then(() => d.removeValue(vkey))
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expect(actual).to.be.null)
//         );
//     });

//     it('Read key list', () => {
//         const expected = ['key1', 'key2', 'key3'];
//         return execForEachDb(d =>
//             Promise.all(expected.map(k => d.setValue(k, 0)))
//                 .then(() => d.getAllKeys())
//                 .then(actual => actual.should.eql(expected))
//         );
//     });

//     it('Delete database', () => {
//         const vkey = 'test';
//         const expected = 10;
//         return execForEachDb(d =>
//             d.setValue(vkey, expected)
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expected.should.equal(actual))
//                 .then(() => d.clear())
//                 .then(() => d.getAllKeys())
//                 .then(actual => actual.should.eql([]))
//         );
//     });

//     it('User and System databases are truly independent', () => {
//         const db = require('../../../src/db/tiny-db');
//         const vkey = 'test';
//         const userValue = 'user';
//         const systemValue = 'system';
//         return db.user.setValue(vkey, userValue)
//             .then(() => db.system.setValue(vkey, systemValue))
//             .then(() => db.user.getValue(vkey))
//             .then(actual => userValue.should.equal(actual))
//             .then(() => db.system.getValue(vkey))
//             .then(actual => systemValue.should.equal(actual));
//     });

//     it('User db always encrypts values', () => {
//         const db = require('../../../src/db/tiny-db');
//         const keys = require('../../../src/crypto/keys');
//         const vkey = 'test';
//         const expected = 'encrypted value';
//         return db.user.setValue(vkey, expected)
//             .then(() => db.user.getValue(vkey))
//             .then(actual => expected.should.equal(actual))
//             .then(() => db.openUser(username, keys.generateEncryptionKey()))
//             .then(() => db.user.getValue(vkey))
//             .then(actual => expect(actual).to.be.null);
//     });

//     it('Should not allow empty keys', () => {
//         return execForEachDb(d => {
//             return Promise.any([
//                 d.setValue('', 1),
//                 d.getValue(''),
//                 d.removeValue(''),
//                 d.setValue(null, 1),
//                 d.getValue(null),
//                 d.removeValue(null),
//                 d.setValue(undefined, 1),
//                 d.getValue(undefined),
//                 d.removeValue(undefined)
//             ])
//                 .then(() => Promise.reject('test failed')) // fail test if any of promises resolves
//                 .catch(Promise.AggregateError, () => Promise.resolve());
//         });
//     });

//     it('Undefined value should be stored as null', () => {
//         const vkey = 'test';
//         return execForEachDb(d =>
//             d.setValue(vkey)
//                 .then(() => d.getValue(vkey))
//                 .then(actual => expect(actual).to.be.null)
//         );
//     });
// });
