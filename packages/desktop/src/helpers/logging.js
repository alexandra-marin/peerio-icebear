// const isDevEnv = require('~/helpers/is-dev-env');
// const Airbrake = require('airbrake-js');
// const config = require('~/config');
// const { User, socket } = require('peerio-icebear');
// const { reaction } = require('mobx');

// /**
//  * Plugs into the Airbrake API in order to send errors.
//  *
//  * @class AirbrakeTransport
//  * @extends {L.Transport}
//  *
//  */
// class AirbrakeTransport extends L.Transport {
//     constructor() {
//         super();
//         this.airbrake = new Airbrake({
//             projectId: 1,
//             projectKey: config.errorServerProjectKey,
//             host: config.errorServerUrl
//         });
//     }

//     write(msg) {
//         this.airbrake.notify({
//             error: msg,
//             environment: {
//                 platform: config.platform,
//                 arch: config.arch,
//                 clientVersion: config.appVersion,
//                 isDevBuild: isDevEnv,
//                 server: config.socketServerUrl
//             }
//         });
//     }
// }

// // configure logging
// L.level = L.LEVELS.SILLY;
// L.captureGlobalErrors();

// // no garbage in our error server in broken dev builds
// if (!isDevEnv) {
//     L.level = L.LEVELS.INFO;

//     if (config.errorServerUrl && config.errorServerUrl) {
//         const airbrakeTransport = new AirbrakeTransport();
//         L.addTransport('airbrake', airbrakeTransport, L.LEVELS.ERROR);
//         // adapt to user settings
//         socket.onceAuthenticated(() => {
//             reaction(() => User.current.settings.errorTracking, userReportsErrors => {
//                 if (userReportsErrors === false) {
//                     L.removeTransport('airbrake');
//                 } else {
//                     console.log('now reporting errors to error server');
//                     L.addTransport('airbrake', airbrakeTransport);
//                 }
//             });
//         });
//     }
// }

// if (process.type !== 'renderer') {
//     require('~/main-process/fs-logging');
// }
