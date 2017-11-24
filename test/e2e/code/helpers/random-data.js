
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

module.exports = { getRandomUsername };
