/* eslint-disable strict */
/* eslint-disable import/no-extraneous-dependencies */
const cp = require('child_process');
const chalk = require('chalk');
const makeBoom = require('./bfg');

// creating log file that will be passed down to other actors in this process
cp.execSync('mkdir -p bfglogs');
const SimpleNodeLogger = require('simple-node-logger');
const opts = {
    logFilePath: `./bfglogs/bfg-${new Date().toISOString()}.log`,
    timestampFormat: 'HH:mm:ss.SSS'
};
console.log(chalk.green(`## Created logfile ${opts.logFilePath}`));
const log = SimpleNodeLogger.createSimpleLogger(opts);

// make sure we're up to date with the build
console.log(chalk.green('## Building icebear...'));
cp.execSync('npm run test-build');

// fire the BFG
console.log(chalk.green('## Firing the bfg...'));
makeBoom(log, 10);

setInterval(() => {}, 5000);
