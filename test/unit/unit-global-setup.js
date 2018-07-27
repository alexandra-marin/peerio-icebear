require("@babel/register");

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { Promise } = require('bluebird');

chai.should();
chai.use(chaiAsPromised);

if (!console.debug) {
    console.debug = console.log.bind(console);
}

global.expect = chai.expect;
global.Promise = Promise;
