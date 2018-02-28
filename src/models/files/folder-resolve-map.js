const { observable } = require('mobx');

const folderResolveMap = observable.shallowMap({});

window.folderResolveMap = folderResolveMap;
module.exports = folderResolveMap;
