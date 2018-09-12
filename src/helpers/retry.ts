/**
 * Retry operation tools.
 */

import { normalize, serverErrorCodes, DisconnectedError, ServerErrorType } from '../errors';
import tracker from '../models/update-tracker';

const maxRetryCount = 120; // will bail out after this amount of retries
const minRetryInterval = 1000; // will start with this interval between retries
const maxRetryInterval = 10000; // this will be the maximum interval between retries
const retryIntervalMultFactor = 250; // every retry will add this amount to retry interval
const maxFatalErrorsCount = 2;

interface CallInfo {
    options: RetryOptions;
    retryCount: number;
    fatalErrorCount: number;
    promise: Promise<any>;
    resolve?: (res?: any) => any;
    reject?: (err?: any) => any;
    lastError?: any;
}

interface RetryOptions {
    id?: string;
    maxRetries?: number;
    errorHandler?: (err: Error | ServerErrorType) => Promise<void>;
    retryOnlyOnDisconnect?: boolean;
}

const callsInProgress: { [id: string]: CallInfo } = {};

/**
 * 1. Executes the passed function
 * 2. If promise returned by function rejects - goto 1
 * Makes sure socket is authenticated before calling, and waits for it to become authenticated if needed.
 * @param fn - function to execute
 * @param options.id - unique id for this action, to prevent multiple parallel attempts
 * @param options.maxRetries - override if needed
 * @param options.errorHandler - specify handler for errors with specific name,
 *                                retry attempts will continue if handler promise resolves.
 *                                Error handler will not get called if DisconnectedError occurs.
 * @param options.retryOnlyOnDisconnect - retry only occurs if task got rejected because of disconnection.
 *                                        If this option is set to 'true', errorHandler will be ignored.
 * @param thisIsRetry - for internal use only
 * @returns A Promise that resolves when action is finally executed or rejects after all attempts are exhausted
 */
export function retryUntilSuccess<T = any>(
    fn: () => Promise<T>,
    options: RetryOptions = {
        id: Math.random().toString(),
        maxRetries: maxRetryCount,
        retryOnlyOnDisconnect: false
    },
    thisIsRetry?: boolean
): Promise<T> {
    if (!options.id) options.id = Math.random().toString();
    if (!options.maxRetries) options.maxRetries = maxRetryCount;
    if (options.retryOnlyOnDisconnect) {
        if (options.errorHandler)
            throw new Error('errorHandler can not be set together with retryOnlyOnDisconnect');
        // any error leads to stopping retry
        // disconnect error never triggers errorHandler call
        options.errorHandler = async err => {
            if (err && err.name === 'NotAuthenticatedError') return;
            throw err;
        };
    }
    let callInfo = callsInProgress[options.id];
    // don't make parallel calls
    if (!thisIsRetry && callInfo) return callInfo.promise;
    if (!callInfo) {
        callInfo = {
            options,
            retryCount: 0,
            fatalErrorCount: 0
        } as CallInfo;
        callInfo.promise = new Promise((resolve, reject) => {
            callInfo.resolve = resolve;
            callInfo.reject = reject;
        });
        callsInProgress[options.id] = callInfo;
    }
    fn()
        .tap(res => {
            callInfo.resolve(res);
            delete callsInProgress[options.id];
        })
        .catch((err: Error | ServerErrorType) => {
            console.error(err);
            callInfo.lastError = err;
            if (err) {
                if ((<ServerErrorType>err).code === serverErrorCodes.notFound) {
                    callInfo.fatalErrorCount++;
                }
                if ((<ServerErrorType>err).code === serverErrorCodes.accountBlacklisted) {
                    callInfo.fatalErrorCount = maxFatalErrorsCount + 1;
                }
                if (options.errorHandler && !(err instanceof DisconnectedError)) {
                    options
                        .errorHandler(err)
                        .then(() => scheduleRetry(fn, options.id))
                        .catch(handlerErr => {
                            console.error(handlerErr);
                            console.error(
                                `Retry error handler for ${
                                    options.id
                                } rejected. Giving up, rejecting promise.`
                            );
                            console.debug(fn);
                            callInfo.reject(normalize(callInfo.lastError));
                        });
                    return;
                }
            }
            scheduleRetry(fn, options.id);
        });

    return callInfo.promise;
}
// todo: don't retry if throttled
function scheduleRetry(fn: () => Promise<any>, id: string): void {
    const callInfo = callsInProgress[id];
    if (
        ++callInfo.retryCount > callInfo.options.maxRetries ||
        callInfo.fatalErrorCount > maxFatalErrorsCount
    ) {
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
        () => tracker.onceUpdated(() => retryUntilSuccess(fn, callInfo.options, true)),
        delay
    );
}

export function isRunning(id: string) {
    return !!callsInProgress[id];
}
