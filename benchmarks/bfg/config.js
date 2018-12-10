module.exports = {
    USER_COUNT: 500, // how many users in chat
    // every user sends a message with a random pause within following interval
    MIN_MSG_INTERVAL: 120000,
    MAX_MSG_INTERVAL: 240000,
    TELEMETRY_INTERVAL: 3000, // print telemetry every TELEMETRY_INTERVAL milliseconds
    EXTRA_USERS: ['anri'], // extra users to add to bot chat
    PRINT_HOST_STDOUT: false // wether or not to output host process (one of the bots) stdout/err
};
