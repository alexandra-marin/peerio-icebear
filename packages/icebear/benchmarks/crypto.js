const cryptoUtil = require('../src/crypto/util');
const cryptoKeys = require('../src/crypto/keys');
const secret = require('../src/crypto/secret');
const publicCrypto = require('../src/crypto/public');
const sign = require('../src/crypto/sign');
const measure = require('./measure');

async function encrypt() {
    const key = cryptoKeys.generateEncryptionKey();
    const measurements = [{ len: 8192, n: 1000 }, { len: 512, n: 10000 }];

    for (const { len, n } of measurements) {
        const message = cryptoUtil.getRandomBytes(len);
        await measure(
            `Encrypt ${n} ${message.length}-byte messages with random nonce`,
            async () => {
                for (let i = 0; i < n; i++) {
                    await secret.encrypt(message, key);
                }
            }
        );
    }
}

async function decrypt() {
    const key = cryptoKeys.generateEncryptionKey();
    const message = cryptoUtil.getRandomBytes(8192);
    const encrypted = await secret.encrypt(message, key);
    const n = 1000;

    await measure(`Decrypt ${n} ${message.length}-byte messages with random nonce`, async () => {
        for (let i = 0; i < n; i++) {
            await secret.decrypt(encrypted, key);
        }
    });
}

async function sign() {
    const signingKeyPair = cryptoKeys.generateSigningKeyPair();
    const message = cryptoUtil.getRandomBytes(1024);
    const n = 500;

    await measure(`Sign ${n} ${message.length}-byte messages`, async () => {
        for (let i = 0; i < n; i++) {
            await sign.signDetached(message, signingKeyPair.secretKey);
        }
    });
}

async function sharedKey() {
    const keyPair = cryptoKeys.generateEncryptionKeyPair();
    const n = 1000;

    await measure(`Compute ${n} shared keys`, async () => {
        for (let i = 0; i < n; i++) {
            await publicCrypto.computeSharedKey(keyPair.publicKey, keyPair.secretKey);
        }
    });
}

module.exports = async function() {
    await encrypt();
    await decrypt();
    await sharedKey();
    await sign();
};
