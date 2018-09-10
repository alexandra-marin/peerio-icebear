import testConfig from '../test-config';

const usernameChars = '0123456789abcdefghijklmnopqrstuvwxyz_';
const numbers = '0123456789';

/**
 * Generates a valid random username of maximum allowed length
 */
export const getRandomUsername = () => {
    let username = '';
    for (let i = 0; i < 16; i++) {
        username += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return username;
};

export const getRandomMcrId = () => {
    let number = '';
    for (let i = 0; i < 10; i++) {
        number += usernameChars[Math.floor(Math.random() * numbers.length)];
    }
    return `MED${number}`;
};

export const getRandomEmail = () => {
    let email = 'email_';
    for (let i = 0; i < 20; i++) {
        email += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return `${email}@${testConfig.emailDomain}`;
};
