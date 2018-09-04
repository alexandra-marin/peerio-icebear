/**
 * Retry operation tools.
 */

import { normalize, serverErrorCodes } from '../errors';
import tracker from '../models/update-tracker';

const maxRetryCount = 120; // will bail out after this amount of retries
const minRetryInterval = 1000; // will start with this interval between retries
const maxRetryInterval = 10000; // this will be the maximum interval between retries
const retryIntervalMultFactor = 250; // every retry will add this amount to retry interval

interface CallInfo {
    retryCount: number;
    maxRetries: number;
    errorHandler?: () => void | Promise<any>;
    fatalErrorCount: number;
    promise: Promise<any>;
    resolve?: (res?: any) => any;
    reject?: (err?: any) => any;
    lastError?: any;
}

const callsInProgress: { [id: string]: CallInfo } = {};

/**
 * 1. Executes the passed function
 * 2. If promise returned by function rejects - goto 1
 * Makes sure socket is authenticated before calling, and waits for it to become authenticated if needed.
 * @param fn - function to execute
 * @param id - unique id for this action, to prevent multiple parallel attempts
 * @param maxRetries - override if needed
 * @param thisIsRetry - for internal use only
 * @returns A Promise that resolves when action is finally executed or rejects after all attempts are exhausted
 */
export function retryUntilSuccess<T = any>(
    fn: () => Promise<T>,
    id = Math.random().toString(),
    maxRetries = maxRetryCount,
    errorHandler?: () => void | Promise<any>,
    thisIsRetry?: boolean
): Promise<T> {
    let callInfo = callsInProgress[id];
    // don't make parallel calls
    if (!thisIsRetry && callInfo) return callInfo.promise;
    if (!callInfo) {
        callInfo = {
            retryCount: 0,
            maxRetries,
            errorHandler,
            fatalErrorCount: 0
        } as CallInfo;
        callInfo.promise = new Promise((resolve, reject) => {
            callInfo.resolve = resolve;
            callInfo.reject = reject;
        });
        callsInProgress[id] = callInfo;
    }
    fn()
        .tap(res => {
            callInfo.resolve(res);
            delete callsInProgress[id];
        })
        .catch(err => {
            console.error(err);
            callInfo.lastError = err;
            if (err) {
                if (err.code === serverErrorCodes.notFound) {
                    callInfo.fatalErrorCount++;
                }
                if (errorHandler && err.code === serverErrorCodes.malformedRequest) {
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
function scheduleRetry(fn: () => Promise<any>, id: string): void {
    const callInfo = callsInProgress[id];
    if (++callInfo.retryCount > callInfo.maxRetries || callInfo.fatalErrorCount > 2) {
        console.error(
            `Maximum retry count reached for action id ${id}. Giving up, rejecting promise.`
        );
        console.debug(fn);
        callInfo.reject(normalize(callInfo.lastError));
        return;
    }
    const delay =
        minRetryInterval +
        Math.min(maxRetryInterval, callInfo.retryCount * retryIntervalMultFactor);
    console.debug(`Retrying ${id} in ${delay} second`);
    setTimeout(
        () =>
            tracker.onceUpdated(() =>
                retryUntilSuccess(fn, id, callInfo.maxRetries, callInfo.errorHandler, true)
            ),
        delay
    );
}

export function isRunning(id: string) {
    return !!callsInProgress[id];
}
