/**
 * Validates fields in a form.
 */

import { reaction, extendObservable, computed } from 'mobx';
export { default as validators } from './user-validators';

interface IValidationStore {
    byName: object;
    byOrder: object;
    validatedFields: Array<string>;
    isValid: boolean | (() => boolean);
    resetValidationState: () => void;
}
interface IValidator {
    action: (value: any, fieldName: string) => Promise<boolean | { message: string } | string>;
    message: string;
}
/**
 * Takes an observable store for a form, a field name, as well as validators
 * and an optional position of the field relative to the form, and
 * attaches validation handlers and triggers for validation.
 *
 * onChange and onBlur handlers must be manually attached to the input
 * in peerio-desktop, the ValidatedInput can be used
 *
 */
export function addValidation(
    store: IValidationStore,
    fieldName: string,
    validatorOrArray: Array<IValidator> | IValidator,
    positionInForm: number
) {
    const byName = store.byName || {};
    const byOrder = store.byOrder || {};
    // const focus = store.focus || {};
    byName[fieldName] = positionInForm;
    byOrder[positionInForm] = fieldName;
    Object.assign(store, { byName, byOrder });

    const fValid = `${fieldName}Valid`;
    const fValidationMessageComputed = `${fieldName}ValidationMessage`;
    const fieldValidationMessageText = `${fieldName}ValidationMessageText`;
    const fDirty = `${fieldName}Dirty`;
    const fOnChange = `${fieldName}OnChange`;
    const fOnBlur = `${fieldName}OnBlur`;
    const fieldValidators = Array.isArray(validatorOrArray) ? validatorOrArray : [validatorOrArray];

    store.validatedFields = store.validatedFields || [];
    store.validatedFields.push(fieldName);

    store.isValid =
        store.isValid ||
        (() => store.validatedFields.reduce((acc, field) => acc && !!store[`${field}Valid`], true));

    store.resetValidationState =
        store.resetValidationState ||
        (() =>
            store.validatedFields.forEach(field => {
                store[`${field}Dirty`] = undefined;
                store[`${field}ValidationMessageText`] = undefined;
            }));

    const extend = {};

    if (store[fValid] === undefined) {
        extend[fValid] = false;
    }
    if (store[fieldValidationMessageText] === undefined) {
        extend[fieldValidationMessageText] = '';
    }
    if (store[fValidationMessageComputed] === undefined) {
        // only show error if the field is dirty
        extend[fValidationMessageComputed] = computed(() => {
            return store[fDirty] ? store[fieldValidationMessageText] : '';
        });
    }
    if (store[fDirty] === undefined) {
        extend[fDirty] = false;
    }
    extendObservable(store, extend);

    // mark field (& those before it) as dirty on change
    store[fOnChange] = (/* val */) => {
        store[fDirty] = true;
        if (positionInForm !== undefined) {
            for (let i = 0; i <= positionInForm; ++i) {
                const otherField = byOrder[i];
                if (otherField) {
                    store[`${otherField}Dirty`] = true;
                }
            }
        }
    };

    // mark the field as dirty when blurred
    store[fOnBlur] = () => {
        store[fDirty] = true;
    };

    // when field changes, reaction is triggered
    reaction(
        () => store[fieldName],
        async value => {
            store[fValid] = false;
            store[fieldValidationMessageText] = '';
            const validationPromises = [];
            fieldValidators.forEach(v => {
                const { action, message } = v;
                const executor = async () => {
                    const result = await action(value, fieldName);
                    if (result === true) return true;
                    let errorMessage;
                    if (result === false) errorMessage = message;
                    else if (typeof result === 'object') errorMessage = result.message;
                    else errorMessage = result;
                    throw new Error(errorMessage);
                };
                validationPromises.push(executor());
            });
            let valid = true;
            let message = '';
            try {
                await Promise.all(validationPromises);
            } catch (error) {
                valid = false;
                ({ message } = error);
            }

            // if the state changed during evaluation, abort
            if (store[fieldName] !== value) return;
            store[fValid] = valid;
            store[fieldValidationMessageText] = message;
        },
        { fireImmediately: true }
    );
}
