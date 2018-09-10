/**
 * @todo @seavan @flohdot
 * Validation functions for user-related fields, used in field validation.
 *
 * On *peerio-desktop* they are used in conjunction with the ValidatedInput and OrderedFormStore
 * components. ValidatedInputs expect validators of the format below as parameters,
 * and will run through them on change & blur as needed.
 *
 * Validators are (arrays of) objects, with signature:
 *  {
 *      action: 'function',
 *      message: ''
 *  }
 *
 *  The action function accepts arguments:
 *  - value -- usually a string
 *  - additionalArguments -- optional object
 *
 *  It returns true if the value passes validation. Otherwise it may return an
 *  object with the signature:
 *
 *  {
 *      message: 'optional specific validation message (string)',
 *      result: false
 *      // additional data as needed
 *  }
 *
 *  if the function does not return a message, the default message provided by the
 *  validator will be used.
 *
 */
const socket = require('../../network/socket');
const { getFirstLetter } = require('../string');
const config = require('../../config');

const VALIDATION_THROTTLING_PERIOD_MS = 400;
const usernameRegex = /^\w{1,16}$/;
const emailRegex = /^[\w]+@[\w]+\.+[\w]/i;
const medicalIdRegex = /MED\d{10}/i;
const usernameLength = config.user.maxUsernameLength;
// const phoneRegex =
//     /^\s*(?:\+?(\d{1,3}))?([-. (]*(\d{3})[-. )]*)?((\d{3})[-. ]*(\d{2,4})(?:[-.x ]*(\d+))?)\s*$/i;

const serverValidationStore = { request: {} };
/**
 * Throttled & promisified call to validation API.
 *
 * @param {string} context -- context for field, e.g "signup"
 * @param {string} name -- field name
 * @param {*} value
 * @returns {Promise<boolean>}
 */
function _callServer(context, name, value, subkey) {
    const key = `${context}::${name}::${subkey}`;
    const pending = serverValidationStore.request[key];
    if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(undefined);
    }
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            socket
                .send('/noauth/validate', { context, name, value }, false)
                .then(resp => {
                    resolve(!!resp && resp.valid);
                })
                .catch(e => {
                    if (e && e.name === 'DisconnectedError') resolve(undefined);
                    else resolve(false);
                });
        }, VALIDATION_THROTTLING_PERIOD_MS);
        serverValidationStore.request[key] = { timeout, resolve };
    });
}

function isValidUsernameLength(name) {
    if (name) {
        return Promise.resolve(name.length <= usernameLength);
    }
    return Promise.resolve(false);
}

function isValidUsername(name) {
    if (name) {
        return Promise.resolve(!!name.match(usernameRegex));
    }
    return Promise.resolve(false);
}

function isValidEmail(val) {
    return Promise.resolve(emailRegex.test(val));
}

function isValidMedicalId(val) {
    return Promise.resolve(medicalIdRegex.test(val));
}

function isValid(context, name, subKey) {
    return (value, n) =>
        value ? _callServer(context, name || n, value, subKey) : Promise.resolve(false);
}

function isNonEmptyString(name) {
    return Promise.resolve(name.length > 0);
}

function isValidLoginUsername(name) {
    return (
        isValid('signup', 'username')(name)
            // we get undefined for throttled requests and false for completed
            .then(value => (value === undefined ? value : value === false))
    );
}

function areEqualValues(value, additionalArguments) {
    if (additionalArguments.required !== false && (!value || value.length === 0)) {
        return Promise.resolve({
            result: false,
            message: 'error_fieldRequired'
        });
    }
    if (value === additionalArguments.equalsValue) return Promise.resolve(true);
    return Promise.resolve({
        result: false,
        message: additionalArguments.equalsErrorMessage
    });
}

function pair(action, message) {
    return { action, message };
}

const isValidSignupEmail = isValid('signup', 'email');
const isValidSignupUsername = isValid('signup', 'username');
const isValidSignupUsernameSuggestion = isValid('signup', 'username', 'suggestion');
const isValidSignupFirstName = isValid('signup', 'firstName');
const isValidSignupLastName = isValid('signup', 'lastName');
const emailFormat = pair(isValidEmail, 'error_invalidEmail');
const medicalIdFormat = pair(isValidMedicalId, 'mcr_error_ahrpa');
const emailAvailability = pair(isValidSignupEmail, 'error_addressTaken');
const usernameFormat = pair(isValidUsername, 'error_usernameBadFormat');
const usernameLengthCheck = pair(isValidUsernameLength, 'error_usernameLengthExceeded');
const usernameAvailability = pair(isValidSignupUsername, 'error_usernameNotAvailable');
const usernameExistence = pair(isValidLoginUsername, 'error_usernameNotFound');
const stringExists = pair(isNonEmptyString, 'error_fieldRequired');
const firstNameReserved = pair(isValidSignupFirstName, 'error_invalidName');
const lastNameReserved = pair(isValidSignupLastName, 'error_invalidName');
const valueEquality = pair(areEqualValues, 'error_mustMatch');
const isValidMcrDoctorAhpra = isValid('medcryptor_doctor', 'ahpra');
const isValidMcrAdminAhpra = isValid('medcryptor_admin', 'ahpra');
const mcrDoctorAhpraAvailability = pair(isValidMcrDoctorAhpra, 'mcr_error_ahrpa');
const mcrAdminAhpraAvailability = pair(isValidMcrAdminAhpra, 'mcr_error_ahrpa');

const suggestUsername = async (firstName, lastName) => {
    const initial = getFirstLetter(firstName);
    const maxSuggestions = 3;
    const suggestions = [];

    const options = [
        `${firstName}`,
        `${firstName}${lastName}`,
        `${firstName}_${lastName}`,
        `${lastName}`,
        `${initial}${lastName}`,
        `${lastName}${initial}`
    ];

    const validOptions = options.map(x =>
        x
            .trim()
            .replace(/[^a-z|A-Z|0-9|_]/g, '')
            .substring(0, usernameLength - 1)
            .toLocaleLowerCase()
    );

    for (const option of validOptions) {
        if (suggestions.length >= maxSuggestions) break;
        const normalized = option.toLocaleLowerCase();
        const available = await isValidSignupUsernameSuggestion(normalized);
        if (available) {
            suggestions.push(normalized);
        }
    }

    return suggestions;
};

const validators = {
    /* available validators:
     * {
     *      message: 'error message (string)',
     *      action: function
     * }
     */
    emailFormat,
    emailAvailability,
    usernameFormat,
    usernameAvailability,
    stringExists,
    firstNameReserved,
    lastNameReserved,
    email: [stringExists, emailFormat, emailAvailability],
    username: [stringExists, usernameFormat, usernameAvailability, usernameLengthCheck],
    usernameLogin: [stringExists, usernameFormat, usernameExistence],
    firstName: [stringExists, firstNameReserved],
    lastName: [stringExists, lastNameReserved],
    mcrDoctorAhpraAvailability,
    mcrAdminAhpraAvailability,
    medicalIdFormat,
    valueEquality,
    isValidSignupEmail,
    isValidSignupFirstName,
    isValidSignupLastName,
    isValidLoginUsername,
    suggestUsername
};

module.exports = validators;
