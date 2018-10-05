const config = require('~/config');

let SignupLink = require('~/ui/login/SignupLink');

if (config.whiteLabel.name === 'medcryptor') {
    SignupLink = require('~/ui/login/SignupLink_medcryptor');
}

module.exports = SignupLink;
