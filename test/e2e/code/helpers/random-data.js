const testConfig = require('../test-config');

const usernameChars = '0123456789abcdefghijklmnopqrstuvwxyz_';
/**
 * Generates a valid random username of maximum allowed length
 */
const getRandomUsername = () => {
    let username = '';
    for (let i = 0; i < 16; i++) {
        username += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return username;
};

const getRandomEmail = () => {
    let email = 'email_';
    for (let i = 0; i < 20; i++) {
        email += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return `${email}@${testConfig.emailDomain}`;
};

module.exports = { getRandomUsername, getRandomEmail };
