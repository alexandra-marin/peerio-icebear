global.setupTimeout = function(test) {
    // in future we can have different
    test.timeout(50000);
};

/**
 * Globally available timeout promise.
 */
global.delay = function(duration) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
};

if (process.env.PEERIO_STAGING_SOCKET_SERVER) {
    console.log(
        `Running tests against staging server ${
            process.env.PEERIO_STAGING_SOCKET_SERVER
        }`
    );
} else {
    console.log('Running tests against production server.');
}

/**
 * allow tests to run independently (if signup isn't run first on dev machine)
 */
global.testUser = {
    username: process.env.PEERIO_STAGING_SOCKET_SERVER
        ? process.env.PEERIO_DESKTOP_STAGING_TEST_USERNAME
        : process.env.PEERIO_DESKTOP_PROD_TEST_USERNAME,
    passphrase: process.env.PEERIO_STAGING_SOCKET_SERVER
        ? process.env.PEERIO_DESKTOP_STAGING_TEST_PASSPHRASE
        : process.env.PEERIO_DESKTOP_PROD_TEST_PASSPHRASE,
    passcode: process.env.PEERIO_STAGING_SOCKET_SERVER
        ? process.env.PEERIO_DESKTOP_STAGING_TEST_PASSCODE
        : process.env.PEERIO_DESKTOP_PROD_TEST_PASSCODE
};
