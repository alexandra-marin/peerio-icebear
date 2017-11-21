// const { spawn } = require('child_process');
// const Promise = require('bluebird');

// const cucumberPath = 'node_modules/.bin/cucumber.js';
// const featurePath = 'test/e2e/spec';
// const supportCodePath = 'test/e2e/supportCode';
// const { secretPassphrase } = require('./constants');

// const getPeerioDataFrom = (output) => {
//     const dataRegex = /<peerioData>.+<\/peerioData>/g;

//     let found = output.match(dataRegex);
//     if (found) {
//         found = found.map(x => x.replace('<peerioData>', ''));
//         found = found.map(x => x.replace('</peerioData>', ''));
//     }

//     try {
//         const result = JSON.parse(found);
//         return result;
//     } catch (err) {
//         return {};
//     }
// };

// const getScenarioSummary = (output) => {
//     const dataRegex = /\d+ scenario(|s) \(.*\)/g;

//     const found = output.match(dataRegex);
//     return found;
// };

// const scenarioPassed = (output) => {
//     const result = getScenarioSummary(output).toString();
//     const hasFailed = !!result.match(/failed/);
//     const hasSkipped = !!result.match(/skipped/);

//     return result && !hasFailed && !hasSkipped;
// };

// const runFeature = (scenarioName, peerioData = null) => {
//     return new Promise((resolve) => {
//         let output = '';
//         let errors = '';

//         const options = [
//             featurePath,
//             '-r',
//             'test/e2e/e2e-global-setup.js',
//             '-r',
//             supportCodePath,
//             '--compiler',
//             'js:babel-register',
//             '--format',
//             'node_modules/cucumber-pretty',
//             '--name',
//             scenarioName
//         ];

//         const env = Object.create(process.env);
//         if (peerioData !== null) {
//             env.peerioData = null;
//             env.peerioData = JSON.stringify(peerioData);
//         }
//         const proc = spawn(cucumberPath, options, { env });

//         proc.stdout.on('data', (data) => {
//             process.stdout.write(data);
//             output += data.toString();
//         });

//         proc.stderr.on('data', (data) => {
//             process.stdout.write(data);
//             errors += data.toString();
//         });

//         proc.on('close', () => {
//             const result = {};
//             result.succeeded = scenarioPassed(output);

//             if (result.succeeded) {
//                 result.data = getPeerioDataFrom(output);
//             }

//             if (errors) {
//                 result.errors = errors;
//             }

//             resolve(result);
//         });
//     });
// };

// const runFeatureFromUsername = (feature, username) => {
//     const user = { username, passphrase: secretPassphrase };
//     return runFeature(feature, user);
// };

// const runFeatureForChatId = (feature, username, chatId) => {
//     const data = { username, passphrase: secretPassphrase, chatId };
//     return runFeature(feature, data);
// };

// const checkResult = (result) => {
//     if (result.succeeded) {
//         return Promise.resolve();
//     }
//     return Promise.reject(result.errors);
// };

// const checkResultAnd = (result) => {
//     if (result.succeeded) {
//         return Promise.resolve(result.data);
//     }
//     return Promise.reject(result.errors);
// };

// module.exports = {
//     runFeature,
//     runFeatureFromUsername,
//     runFeatureForChatId,
//     checkResult,
//     checkResultAnd
// };
