//
//  Crypto keys module testing
//
const crypto = require('~/crypto/keys');
const util = require('~/crypto/util');

describe('Crypto Keys module', function() {
    this.timeout(5000);

    describe('account keys', () => {
        before(() => {
            this.username = 'user';
            this.passphrase = 'hidden award watts chained restored';
            this.salt = util.b64ToBytes('r/g3Xm1OSaESajdXKPjxsefpjH7cKgSyX14KRUtepw0=');

            this.expected = {
                bootKey: util.b64ToBytes('6VdJvLy8r/bDf9iXNIHhktuf4j20IqixWjnX57cQ0QU='),
                authKeyPair: {
                    publicKey: util.b64ToBytes('5clLsoQ9M53zkq9L6SJn01HtlDLPeUdz4ic5GjIsWEI='),
                    secretKey: util.b64ToBytes('SfhzTkRcLxw12REVkPDBntIE9sSFn/WMoNAmCOrS8RA=')
                }

            };
        });

        it('can be derived', () => {
            return crypto.deriveAccountKeys(this.username, this.passphrase, this.salt)
                .then((actual) => {
                    expect(actual).to.deep.equal(this.expected);
                });
        });

        it('cannot be derived without the right salt', () => {
            return crypto.deriveAccountKeys(this.username, this.passphrase, util.b64ToBytes('nonsense'))
                .then((actual) => {
                    expect(actual).not.to.deep.equal(this.expected);
                });
        });

        it('cannot be derived without the right passphrase', () => {
            return crypto.deriveAccountKeys(this.username, 'not hidden award watts chained restored', this.salt)
                .then((actual) => {
                    expect(actual).not.to.deep.equal(this.expected);
                });
        });

        it('cannot be derived without the wrong username', () => {
            return crypto.deriveAccountKeys('badusername', this.passphrase, this.salt)
                .then((actual) => {
                    expect(actual).not.to.deep.equal(this.expected);
                });
        });
    });

    describe('ghost/ephemeral keys', () => {
        before(() => {
            this.ghostID = util.strToBytes('CvfX223vsFuVerNrGS1n1sz4AYfpERb8JbeBeWUYMqdo');
            this.passphrase = 'latch floats varied harper vast';

            this.expected = {
                publicKey: util.b64ToBytes('QOwX70IlZEFh0SlNywooVYiA5OAHkIWn2xa2hoTi5xg='),
                secretKey: util.b64ToBytes('u7CN24qe9AwUh6Hzu6/J2FR9UnVOKfEw7X7p3lw4vzE=')
            };
        });

        it('can be derived', () => {
            return crypto.deriveEphemeralKeys(this.ghostID, this.passphrase)
                .then((kp) => {
                    expect(kp.secretKey).to.deep.equal(this.expected.secretKey);
                    expect(kp.publicKey).to.deep.equal(this.expected.publicKey);
                });
        });

        it('cannot be derived from a bad id', () => {
            return crypto.deriveEphemeralKeys('not the real ghost id heheheheh', this.passphrase)
                .then((kp) => {
                    expect(kp.secretKey).not.to.deep.equal(this.expected.secretKey);
                    expect(kp.publicKey).not.to.deep.equal(this.expected.publicKey);
                });
        });

        it('cannot be derived from a bad passphrase', () => {
            return crypto.deriveEphemeralKeys(this.ghostID, 'blabla bla bla')
                .then((kp) => {
                    expect(kp.secretKey).not.to.deep.equal(this.expected.secretKey);
                    expect(kp.publicKey).not.to.deep.equal(this.expected.publicKey);
                });
        });
    });

    it('should generate signing keys', () => {
        const keys = crypto.generateSigningKeyPair();
        keys.publicKey.length.should.equal(32);
        keys.secretKey.length.should.equal(64);
    });

    it('should generate public key encryption keys', () => {
        const keys = crypto.generateEncryptionKeyPair();
        keys.publicKey.length.should.equal(32);
        keys.secretKey.length.should.equal(32);
    });

    it('should generate symmetric encryption key', () => {
        const key = crypto.generateEncryptionKey();
        key.length.should.equal(32);
    });

    it('should generate a random hex account key', () => {
        const k1 = crypto.getRandomAccountKeyHex();
        const k2 = crypto.getRandomAccountKeyHex();
        k1.should.not.equal(k2);
        k1.length.should.equal(k2.length);
        k1.length.should.equal(39);
        k1.replace(/ /g, '').length.should.equal(32);
    });
});
