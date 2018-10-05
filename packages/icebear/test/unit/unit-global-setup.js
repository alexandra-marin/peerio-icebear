/**
 * THIS FILE HAS TO STAY IN JS, DON'T CONVERT TO TS
 * because it's required directly by mocha currently
 */
require('@babel/register')({
    extensions: ['.jsx', '.js', '.tsx', '.ts']
});

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { Promise } = require('bluebird');

const NodeFileStream = require('../../src/models/files/node-file-stream').default;
const config = require('../../src/config').default;
config.FileStream = NodeFileStream;

chai.should();
chai.use(chaiAsPromised);

if (!console.debug) {
    console.debug = console.log.bind(console);
}

global.Promise = Promise;
