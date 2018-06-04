/**
 * Observable/Promise bridges and tools
 */
const { when } = require('mobx');

/**
 * Makes a promise out of observable.
 * @param {Object} object - any object
 * @param {string} observableProperty - observable property name inside object
 * @param {any} expectedValue - resolve promise when observable property has this value (strict equality ===)
 * @returns {Promise}
 */
function asPromise(object, observableProperty, expectedValue) {
    return new Promise(resolve => {
        when(() => object[observableProperty] === expectedValue, () => setTimeout(resolve));
    });
}

/**
 * Makes a promise out of observable.
 * @param {Object} object - any object
 * @param {string} observableProperty - observable property name inside object
 * @param {any} unwantedValue - resolve promise when observable property doesn't have this value (strict equality !==)
 * @returns {Promise}
 */
function asPromiseNegative(object, observableProperty, unwantedValue) {
    return new Promise(resolve => {
        when(() => object[observableProperty] !== unwantedValue, () => setTimeout(resolve));
    });
}


/**
 * Makes a promise out of observable.
 * @param {Object} object - any object
 * @param {string} observableProperty - observable property name inside object
 * @param {Array<any>} expectedValue - resolve promise when observable property has one of this values ( strict === )
 * @returns {Promise}
 */
function asPromiseMultiValue(object, observableProperty, expectedValues) {
    return new Promise(resolve => {
        when(
            () => {
                for (let i = 0; i < expectedValues.length; i++) {
                    if (object[observableProperty] === expectedValues[i]) return true;
                }
                return false;
            },
            () => setTimeout(resolve)
        );
    });
}

module.exports = { asPromise, asPromiseNegative, asPromiseMultiValue };
