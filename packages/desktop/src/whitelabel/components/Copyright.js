const config = require('~/config');

let Copyright = require('~/ui/settings/components/Copyright');

if (config.whiteLabel.name) {
    Copyright = require('~/ui/settings/components/Copyright_WL');
}

module.exports = Copyright;
