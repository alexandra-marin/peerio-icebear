const config = require('~/config');

let Chat = require('~/ui/chat/Chat');

if (config.whiteLabel.name === 'medcryptor') {
    Chat = require('~/ui/chat/Chat_medcryptor');
}

module.exports = Chat;
