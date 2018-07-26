//
// Test helpers
//

const usernameChars = '0123456789abcdefghijklmnopqrstuvwxyz';
// generates 16-character random usernames
function getRandomUsername() {
    let username = '';
    for (let i = 0; i < 30; i++) {
        username += usernameChars[Math.floor(Math.random() * usernameChars.length)];
    }
    return username;
}


module.exports = { getRandomUsername };
