/* eslint-disable strict */
const usernameChars = '0123456789abcdefghijklmnopqrstuvwxyz_';

function getRandomUsername() {
    let username = '';
    for (let i = 0; i < 16; i++) {
        username += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return username;
}

/**
 * @param {string} type
 * @param {object} data
 */
function ipcSend(type, data) {
    if (!process.send) {
        console.log('If this was a child process, it would send the next message to the parent:');
        console.log(type, data);
    } else {
        process.send({ type, data });
    }
}

module.exports = { getRandomUsername, ipcSend };
