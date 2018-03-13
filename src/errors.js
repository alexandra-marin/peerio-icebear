/**
 * Peerio custom error types and error handling helpers.
 * ```
 * // CUSTOM ERROR TEMPLATE
 * function CustomError(message, nestedError, otherData) {
 *   var error = Error.call(this, message);
 *   this.name = 'CustomError';
 *   this.message = error.message;
 *   this.stack = error.stack;
 *   this.nestedError = nestedError;
 *   this.otherData = otherData;
 * }
 *
 * CustomError.prototype = Object.create(Error.prototype);
 * CustomError.prototype.constructor = CustomError;
 * ```
 * REFACTOR WARNING: before renaming any errors (not sure why you would do that though),
 *                   make sure they haven't been used by name anywhere.
 * @module errors
 * @public
 */

// jsdoc freaks out and merges next jsdoc with previous if this var is not defined here
let a; // eslint-disable-line

/**
 * Use this helper to resolve returning error value.
 * If you:
 * - have an error result from catch() or reject()
 * - don't know what exactly that result is, Error, string, undefined or something else
 * - don't need custom errors just want to generate meaningful Error object
 *
 * Call normalize and pass the result you've got together with fallback message,
 * that will be wrapped in Error object and returned in case the result wasn't instance of Error
 * @param {any} error - anything you received as an error via catch
 * @param {string} [failoverMessage] - if error will not be of Error instance, this message wrapped in new Error object
 * will be returned
 * @returns {Error}
 * @memberof errors
 * @public
 */
module.exports.normalize = function(error, failoverMessage) {
    if (error instanceof Error) return error;

    if (failoverMessage) return new Error(failoverMessage);

    try {
        const message = typeof error === 'string' ? error : JSON.stringify(error);
        return new Error(message);
    } catch (e) {
        return new Error('unknown error');
    }
};

/**
 * Helper function to create custom errors with less code.
 * It's useful when your custom error only expects to have an optional `message` and `data` object arguments.
 * @param {string} name - custom error name, should match the class name you will use for the error
 * @param {string} msg - default message for the error
 * @returns {function} class, inherited from Error
 * @memberof errors
 * @public
 */
function getGenericCustomError(name, msg) {
    const err = function(message, data) {
        const error = Error.call(this, message || msg);
        this.name = name;
        this.message = error.message || '';
        this.stack = error.stack;
        this.data = data;
    };

    err.prototype = Object.create(Error.prototype);
    err.prototype.constructor = err;
    return err;
}

module.exports.getGenericCustomError = getGenericCustomError;
// -- Custom Errors ----------------------------------------------------------------------------------------------
// As a general rule, create custom errors only when
// - you want to have a message in it, so u don't have to type it every time u throw the error
// - you have some additional data to put into error
// - you need to filter catched error by type
[
    ['DecryptionError'],
    ['EncryptionError'],
    ['AntiTamperError'],
    ['DisconnectedError'],
    ['NotAuthenticatedError'],
    ['AbstractCallError', 'Abstract function call. Override this function.'],
    ['NoPasscodeFoundError', 'No passcode found.'],
    ['InvalidArgumentError'],
    ['UserCancelError'] // when user has cancelled something in progress (like download)
].forEach(errType => {
    module.exports[errType[0]] = getGenericCustomError(errType[0], errType[1]);
});
// -- Server Errors ----------------------------------------------------------------------------------------------
/**
 * Check sources for the list of codes.
 * You can look up this enum both by integer code and by string error name.
 * @memberof errors
 * @public
 */
const serverErrorCodes = {
    genericServerError: 400,
    accessForbidden: 401,
    notFound: 404,
    malformedRequest: 406,
    sdkVersionTooHigh: 408,
    clientVersionDeprecated: 409,
    sdkVersionDeprecated: 410,
    incorrectPublicKey: 411,
    invalidDeviceToken: 412,
    quotaExceeded: 413,
    authError: 423,
    twoFAAuthRequired: 424,
    accountThrottled: 425,
    accountBlacklisted: 426,
    invalid2FACode: 427,
    addressIsTaken: 430,
    usernameIsTaken: 431,
    forbiddenUsername: 432,
    forbiddenName: 433,
    accountMigrationRequired: 434,
    captchaPending: 435,
    incorrectTimestamp: 442,
    fileKegAlreadyExists: 480,
    accountClosed: 488,
    responseValidationError: 501
};
// reverse map
const serverErrorMap = {};
Object.keys(serverErrorCodes).forEach((key) => {
    serverErrorMap[serverErrorCodes[key]] = key;
});

/**
 * Server error, socket throws it when server returns error.
 * @constructor
 * @param {number} code - server error code
 * @param {string} [msg] - message, if any
 * @returns {ServerError}
 * @memberof errors
 * @public
 */
function ServerError(code, msg) {
    const type = serverErrorMap[code] || 'Unknown server error';
    this.message = msg || type;
    const error = Error.call(this, this.message);
    this.name = `ServerError: ${code}: ${type}`;
    this.code = code;
    this.stack = error.stack;
}

ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;
ServerError.codes = serverErrorCodes;
module.exports.ServerError = ServerError;
//----------------------------------------------------------------------------------------------------------------------
