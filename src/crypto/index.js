const cryptoUtil = require('./util');
const keys = require('./keys');
const publicCrypto = require('./public');
const secret = require('./secret');
const sign = require('./sign');
const { setScrypt } = require('./scrypt-proxy');

module.exports = {
    cryptoUtil,
    keys,
    publicCrypto,
    secret,
    sign,
    setScrypt
};
