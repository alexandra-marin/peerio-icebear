const crypto = require('../src/crypto');
const measure = require('./measure');

async function encrypt() {
    const key = crypto.keys.generateEncryptionKey();
    const measurements = [
        { len: 8192, n: 1000 },
        { len: 512, n: 10000 }
    ];

    for (const { len, n } of measurements) {
        const message = crypto.cryptoUtil.getRandomBytes(len);
        await measure(`Encrypt ${n} ${message.length}-byte messages with random nonce`, async () => {
                for (let i = 0; i < n; i++) {
                    await crypto.secret.encrypt(message, key);
                }
        });
    }
}

async function decrypt() {
    const key = crypto.keys.generateEncryptionKey();
    const message = crypto.cryptoUtil.getRandomBytes(8192);
    const encrypted = await crypto.secret.encrypt(message, key);
    const n = 1000;

    await measure(`Decrypt ${n} ${message.length}-byte messages with random nonce`, async () => {
        for (let i = 0; i < n; i++) {
            await crypto.secret.decrypt(encrypted, key);
        }
    });
}

async function sign() {
    const signingKeyPair = crypto.keys.generateSigningKeyPair();
    const message = crypto.cryptoUtil.getRandomBytes(1024);
    const n = 500;

    await measure(`Sign ${n} ${message.length}-byte messages`, async () => {
        for (let i = 0; i < n; i++) {
            await crypto.sign.signDetached(message, signingKeyPair.secretKey);
        }
    });
}

async function sharedKey() {
    const keyPair = crypto.keys.generateEncryptionKeyPair();
    const n = 1000;

    await measure(`Compute ${n} shared keys`, async () => {
        for (let i = 0; i < n; i++) {
            await crypto.publicCrypto.computeSharedKey(keyPair.publicKey, keyPair.secretKey);
        }
    });
}

module.exports = async function() {
    await encrypt();
    await decrypt();
    await sharedKey();
    await sign();
};
