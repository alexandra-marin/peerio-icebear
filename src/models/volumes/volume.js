const AbstractFolder = require('../files/abstract-folder');

class Volume extends AbstractFolder {
    isShared = true;
}

module.exports = Volume;
