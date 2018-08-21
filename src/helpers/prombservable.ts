/**
 * Observable/Promise bridges and tools
 */
import { when } from 'mobx';

/**
 * Makes a promise out of observable.
 * @param object - any object
 * @param observableProperty - observable property name inside object
 * @param expectedValue - resolve promise when observable property has this value (strict equality ===)
 */
export function asPromise(object: {}, observableProperty: string, expectedValue: any) {
    return new Promise<void>(resolve => {
        when(() => object[observableProperty] === expectedValue, () => setTimeout(resolve));
    });
}

/**
 * Makes a promise out of observable.
 * @param object - any object
 * @param observableProperty - observable property name inside object
 * @param unwantedValue - resolve promise when observable property doesn't have this value (strict equality !==)
 */
export function asPromiseNegative(object: {}, observableProperty: string, unwantedValue: any) {
    return new Promise<void>(resolve => {
        when(() => object[observableProperty] !== unwantedValue, () => setTimeout(resolve));
    });
}

/**
 * Makes a promise out of observable.
 * @param object - any object
 * @param observableProperty - observable property name inside object
 * @param expectedValue - resolve promise when observable property has one of this values ( strict === )
 */
export function asPromiseMultiValue(object: {}, observableProperty: string, expectedValues: any[]) {
    return new Promise<void>(resolve => {
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
