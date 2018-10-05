const config = require('~/config');

let NewChannel = require('~/ui/chat/NewChannel');

if (config.whiteLabel.name === 'medcryptor') {
    NewChannel = require('~/ui/chat/NewChannel_medcryptor');
}

module.exports = NewChannel;
