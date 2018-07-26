//
//  Crypto utilities module testing
//
const util = require('~/crypto/util');

describe('Crypto Utilities module', () => {
    [
        {
            name: '2 non-empty arrays',
            arg1: new Uint8Array([1, 5, 7]),
            arg2: new Uint8Array([8, 3, 5, 3, 2]),
            expected: new Uint8Array([1, 5, 7, 8, 3, 5, 3, 2])
        },
        {
            name: 'first array is empty',
            arg1: new Uint8Array([]),
            arg2: new Uint8Array([4, 5]),
            expected: new Uint8Array([4, 5])
        },
        {
            name: 'second array is empty',
            arg1: new Uint8Array([6, 7, 8, 9]),
            arg2: new Uint8Array([]),
            expected: new Uint8Array([6, 7, 8, 9])
        },
        {
            name: 'both arrays are empty',
            arg1: new Uint8Array([]),
            arg2: new Uint8Array([]),
            expected: new Uint8Array([])
        },
        {
            name: 'broken',
            arg1: new Uint8Array([4, 3, 4]),
            arg2: new Uint8Array([5, 6, 7, 8]),
            expected: new Uint8Array([5, 4, 3]),
            negate: true
        }
    ].forEach((test) => {
        it(`should concatenate buffers. case: ${test.name}`, () => {
            const actual = util.concatTypedArrays(test.arg1, test.arg2);
            actual.should.be.instanceOf(Uint8Array);
            test.negate ? actual.should.not.eql(test.expected) : actual.should.eql(test.expected);
        });
    });

    it('should encode and decode string', () => {
        const str = 'test string to decode';
        const bytes = new Uint8Array([116, 101, 115, 116, 32, 115, 116, 114, 105, 110, 103,
            32, 116, 111, 32, 100, 101, 99, 111, 100, 101]);

        const actualBytes = util.strToBytes(str);
        const actualStr = util.bytesToStr(bytes);
        actualBytes.should.be.instanceOf(Uint8Array);
        actualBytes.should.eql(bytes);
        actualStr.should.eql(str);
    });

    it('should encode and decode base64', () => {
        const str = 'ZBYjLgU+Qwk=';
        const bytes = new Uint8Array([100, 22, 35, 46, 5, 62, 67, 9]);
        const actualStr = util.bytesToB64(bytes);
        const actualBytes = util.b64ToBytes(str);
        actualBytes.should.be.instanceOf(Uint8Array);
        actualBytes.should.eql(bytes);
        actualStr.should.eql(str);
    });

    it('should generate nonce', () => {
        const nonce = util.getRandomNonce();
        nonce.should.be.instanceOf(Uint8Array);
        nonce.length.should.equal(24);
    });

    it('should generate random bytes', () => {
        const set1 = util.getRandomBytes(10);
        const set2 = util.getRandomBytes(10);
        set1.should.be.an.instanceOf(Uint8Array);
        set2.should.be.an.instanceOf(Uint8Array);
        set1.should.not.be.deep.eql(set2);
    });

    it('should generate a non-personalized byte hash', () => {
        const string = util.strToBytes('bladiblalala');
        const b64hash = 'ABQX3yKKNjDMvkY7wVqCwpqA7FZWM9tNjM8lkjiXDNA=';
        const hash1 = util.getByteHash(32, string);
        const hash2 = util.getByteHash(16, string);
        hash1.should.deep.equal(util.b64ToBytes(b64hash));
        hash2.length.should.equal(16);
    });

    it('should generate a non-personalized hex hash', () => {
        const string = util.strToBytes('bladiblalala');
        const hash = util.getHexHash(32, string);
        hash.should.deep.equal('001417df228a3630ccbe463bc15a82c29a80ec565633db4d8ccf259238970cd0');
    });

    it('should generate a non-personalized byte hash', () => {
        const string = util.strToBytes('bladiblalala');
        const personalization = 'b123';
        const b64hash = 'BEfBvNVzkBZgS0lbx3kCkd8t2AqeGXMSygzALv00V6w=';
        const hash = util.getByteHash(32, string, personalization);
        hash.should.deep.equal(util.b64ToBytes(b64hash));
    });

    it('should generate a non-personalized hex hash', () => {
        const string = util.strToBytes('bladiblalala');
        const personalization1 = 'b123';
        const personalization2 = 'fg';
        const hash1 = util.getHexHash(32, string, personalization1);
        const hash2 = util.getHexHash(32, string, personalization2);
        hash1.should.deep.equal('0447c1bcd5739016604b495bc7790291df2dd80a9e197312ca0cc02efd3457ac');
        hash2.should.deep.equal('2cf712b1f1f35527d4f3c09ee7ddeca8237f71b0be58cba5cfe11087a434ce82');
    });

    it('should pad and unpad passphrase', () => {
        const passphrase = 'hello world секретная строка';
        const paddedPassphrase = util.padPassphrase(passphrase);
        paddedPassphrase.should.not.equal(passphrase);
        const unpaddedPassphrase = util.unpadPassphrase(paddedPassphrase);
        unpaddedPassphrase.should.equal(passphrase);
    });
});
