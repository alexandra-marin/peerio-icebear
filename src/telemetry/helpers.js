const S = require('./strings');

// Factory for text input events
function textInput(item, location, sublocation, state, errorMsg) {
    const ret = [
        S.TEXT_INPUT,
        { item, state }
    ];

    if (location) ret[1].location = location;
    if (sublocation) ret[1].sublocation = sublocation;

    if (errorMsg) {
        let errorType = '';
        switch (errorMsg) {
            case ('error_usernameBadFormat'):
                errorType = 'Bad Characters';
                break;
            case ('error_usernameNotFound'):
                errorType = 'Username Not Found';
                break;
            case ('error_usernameNotAvailable'):
                errorType = 'Name Already Exists';
                break;
            case ('error_invalidEmail'):
                errorType = 'Not Valid Email';
                break;
            case ('error_addressNotAvailable'):
                errorType = 'Email Not Available';
                break;
            case ('error_fieldRequired'):
                errorType = 'Required';
                break;
            default:
                errorType = errorMsg;
                break;
        }
        ret[1].errorType = errorType;
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
