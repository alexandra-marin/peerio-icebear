//
//  Secret key encryption module testing
//
const crypto = require('~/crypto/secret');
const nacl = require('tweetnacl');
const util = require('~/crypto/util');

describe('Secret key encryption module', () => {
    const key = new Uint8Array([127, 216, 168, 148, 177, 189, 134, 245, 107, 28, 100, 181, 50, 32, 94,
        149, 237, 193, 148, 19, 11, 103, 73, 45, 1, 17, 102, 222, 82, 227, 123, 157]);

    it('should encrypt and decrypt with auto nonce handling', () => {
        const message = new Uint8Array([1, 2, 3, 4, 5]);
        const actual = crypto.decrypt(crypto.encrypt(message, key), key);
        actual.should.eql(message);
    });

    it('should encrypt and decrypt with manual nonce (file chunks)', () => {
        const message = new Uint8Array([1, 2, 3, 4, 5]);
        const nonce = util.getRandomNonce();
        const encrypted = crypto.encrypt(message, key, nonce, false, true);
        const actual = crypto.decrypt(encrypted.subarray(4), key, nonce, false);
        actual.should.eql(message);
        const actual2 = crypto.decrypt(encrypted, key, nonce, true);
        actual2.should.eql(message);
    });

    it('should be compatible with secretbox: new encrypt - old decrypt', () => {
        const message = new Uint8Array([1, 2, 3, 4, 5]);
        const newFormatEncrypted = crypto.encrypt(message, key);
        const nonce = newFormatEncrypted.subarray(-24);
        const box = newFormatEncrypted.subarray(16, -24);
        const decrypted = nacl.secretbox.open(box, nonce, key);
        decrypted.should.eql(message);
    });

    it('should be compatible with secretbox: old encrypt - new decrypt', () => {
        const message = new Uint8Array([1, 2, 3, 4, 5]);
        const nonce = util.getRandomNonce();
        const box = nacl.secretbox(message, nonce, key);
        const oldFormatEncrypted = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...box, ...nonce]);
        const decrypted = crypto.decrypt(oldFormatEncrypted, key);
        decrypted.should.eql(message);
    });

    it('should encrypt string', () => {
        const expected = 'such a secret';
        const encrypted = crypto.encryptString(expected, key);
        const actual = crypto.decryptString(encrypted, key);
        actual.should.eql(expected);
    });
});
