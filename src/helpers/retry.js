/**
 * Retry operation tools.
 */

const errors = require('../errors');
const tracker = require('../models/update-tracker');

const maxRetryCount = 120; // will bail out after this amount of retries
const minRetryInterval = 1000; // will start with this interval between retries
const maxRetryInterval = 10000; // this will be the maximum interval between retries
const retryIntervalMultFactor = 250; // every retry will add this amount to retry interval

const callsInProgress = {};
/**
 * 1. Executes the passed function
 * 2. If promise returned by function rejects - goto 1
 * Makes sure socket is authenticated before calling, and waits for it to become authenticated if needed.
 * @param {function} fn - function to execute
 * @param {string} [id] - unique id for this action, to prevent multiple parallel attempts
 * @param {number} [maxRetries=120] - override if needed
 * @param {bool} [thisIsRetry] - for internal use only
 * @returns {Promise} - resolves when action is finally executed, rejects after all attempts exhausted
 */
function retryUntilSuccess(fn, id = Math.random(), maxRetries = maxRetryCount, errorHandler, thisIsRetry) {
    let callInfo = callsInProgress[id];
    // don't make parallel calls
    if (!thisIsRetry && callInfo) return callInfo.promise;
    if (!callInfo) {
        callInfo = { retryCount: 0, maxRetries, errorHandler, fatalErrorCount: 0 };
        callInfo.promise = new Promise((resolve, reject) => {
            callInfo.resolve = resolve;
            callInfo.reject = reject;
        });
        callsInProgress[id] = callInfo;
    }
    fn().tap((res) => {
        callInfo.resolve(res);
        delete callsInProgress[id];
    }).catch(err => {
        console.error(err);
        callInfo.lastError = err;
        if (err) {
            if (err.code === errors.ServerError.codes.notFound) {
                callInfo.fatalErrorCount++;
            }
            if (errorHandler && err.code === errors.ServerError.codes.malformedRequest) {
                try {
                    const res = errorHandler();
                    if (res && res.then) {
                        res.finally(() => scheduleRetry(fn, id));
                        return;
                    }
                } catch (err2) {
                    console.error(err2);
                }
            }
        }
        scheduleRetry(fn, id);
    });

    return callInfo.promise;
}
// todo: don't retry if throttled
function scheduleRetry(fn, id) {
    const callInfo = callsInProgress[id];
    if (++callInfo.retryCount > callInfo.maxRetries || callInfo.fatalErrorCount > 2) {
        console.error(`Maximum retry count reached for action id ${id}. Giving up, rejecting promise.`);
        console.debug(fn);
        callInfo.reject(errors.normalize(callInfo.lastError));
        return;
    }
    const delay = minRetryInterval + Math.min(maxRetryInterval, (callInfo.retryCount * retryIntervalMultFactor));
    console.debug(`Retrying ${id} in ${delay} second`);
    setTimeout(() => tracker.onceUpdated(
        () => retryUntilSuccess(fn, id, callInfo.maxRetries, callInfo.errorHandler, true)), delay);
}

function isRunning(id) {
    return !!callsInProgress[id];
}

module.exports = { retryUntilSuccess, isRunning };
