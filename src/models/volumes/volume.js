const AbstractFolder = require('../files/abstract-folder');
const { observable } = require('mobx');

class Volume extends AbstractFolder {
    @observable selected = false;
    isShared = true;
}

module.exports = Volume;
