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
 */

/**
 * Use this helper to resolve returning error value.
 * If you:
 * - have an error result from catch() or reject()
 * - don't know what exactly that result is, Error, string, undefined or something else
 * - don't need custom errors just want to generate meaningful Error object
 *
 * Call normalize and pass the result you've got together with fallback message,
 * that will be wrapped in Error object and returned in case the result wasn't instance of Error
 * @param error - anything you received as an error via catch
 * @param failoverMessage - if error will not be of Error instance, this message wrapped in new Error object
 * will be returned
 */
export function normalize(error: any, failoverMessage?: string) {
    if (error instanceof Error) return error;

    if (failoverMessage) return new Error(failoverMessage);

    try {
        const message = typeof error === 'string' ? error : JSON.stringify(error);
        return new Error(message);
    } catch (e) {
        return new Error('unknown error');
    }
}

/**
 * Helper function to create custom errors with less code.
 * It's useful when your custom error only expects to have an optional `message` and `data` object arguments.
 * @param name - custom error name, should match the class name you will use for the error
 * @param msg - default message for the error
 * @returns class, inherited from Error
 */
export function getGenericCustomError(name: string, msg?: string) {
    const err = function(this: Error & { data: any }, message?: string, data?: any): void {
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

// -- Custom Errors ----------------------------------------------------------------------------------------------
// As a general rule, create custom errors only when
// - you want to have a message in it, so u don't have to type it every time u throw the error
// - you have some additional data to put into error
// - you need to filter catched error by type

export const DecryptionError = getGenericCustomError('DecryptionError');
export const EncryptionError = getGenericCustomError('EncryptionError');
export const AntiTamperError = getGenericCustomError('AntiTamperError');
export const DisconnectedError = getGenericCustomError('DisconnectedError');
export const NotAuthenticatedError = getGenericCustomError('NotAuthenticatedError');
export const AbstractCallError = getGenericCustomError(
    'AbstractCallError',
    'Abstract function call. Override this function.'
);
export const NoPasscodeFoundError = getGenericCustomError(
    'NoPasscodeFoundError',
    'No passcode found.'
);
export const InvalidArgumentError = getGenericCustomError('InvalidArgumentError');
export const UserCancelError = getGenericCustomError('UserCancelError');
// -- Server Errors ----------------------------------------------------------------------------------------------
/**
 * Check sources for the list of codes.
 * You can look up this enum both by integer code and by string error name.
 */
export const serverErrorCodes = {
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
    captchaPending: 435,
    incorrectTimestamp: 442,
    fileKegAlreadyExists: 480,
    accountClosed: 488,
    responseValidationError: 501
};
// reverse map
const serverErrorMap = {};
Object.keys(serverErrorCodes).forEach(key => {
    serverErrorMap[serverErrorCodes[key]] = key;
});

type ServerError = Error & { code: number; error: number };

/**
 * Server error, socket throws it when server returns error.
 * @constructor
 * @param code - server error code
 * @param msg - message, if any
 */
export function ServerError(this: ServerError, code: number, msg?: string) {
    const type = serverErrorMap[code] || 'Unknown server error';
    this.message = msg || type;
    const error = Error.call(this, this.message);
    this.name = `ServerError: ${code}: ${type}`;
    this.code = code;
    this.error = code; // I always forget which one is it, code or error, so let it be both
    this.stack = error.stack;
}

ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;
