
const usernameChars = '0123456789abcdefghijklmnopqrstuvwxyz_';
const getRandomUsername = () => {
    let username = '';
    for (let i = 0; i < 30; i++) {
        username += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return username;
};

module.exports = { getRandomUsername };
