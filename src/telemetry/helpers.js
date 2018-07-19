const S = require('./strings');

function errorMessage(msg) {
    const messageNames = {
        error_usernameBadFormat: 'Bad Characters',
        error_usernameNotFound: 'Username Not Found',
        error_usernameNotAvailable: 'Name Already Exists',
        error_invalidEmail: 'Not Valid Email',
        error_addressNotAvailable: 'Email Not Available',
        error_fieldRequired: 'Required'
    };
    return messageNames[msg] || 'Unknown Error Type';
}

// Factory for text input events
function textInput(item, location, sublocation, state, errorMsg) {
    const ret = [
        S.TEXT_INPUT,
        { item, state }
    ];

    if (location) ret[1].location = location;
    if (sublocation) ret[1].sublocation = sublocation;

    if (errorMsg) {
        ret[1].errorType = errorMessage(errorMsg);
    }

    return ret;
}

// Factory for duration events
function duration(item, location, sublocation, startTime) {
    const totalTime = Math.round((Date.now() - startTime) / 1000);

    const ret = [
        S.DURATION,
        { totalTime }
    ];

    if (item) ret[1].item = item;
    if (location) ret[1].location = location;
    if (sublocation) ret[1].sublocation = sublocation;

    return ret;
}

module.exports = {
    textInput,
    duration
};
