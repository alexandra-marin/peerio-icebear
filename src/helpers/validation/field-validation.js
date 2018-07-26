/**
 * @todo @seavan @flohdot
 * Validates fields in a form.
 */

import { reaction, extendObservable, computed } from 'mobx';

const userValidators = require('./user-validators');

/**
 * Takes an observable store for a form, a field name, as well as validators
 * and an optional position of the field relative to the form, and
 * attaches validation handlers and triggers for validation.
 *
 * onChange and onBlur handlers must be manually attached to the input
 * in peerio-desktop, the ValidatedInput can be used
 *
 * @param {Object} store
 * @param {string} fName - field name
 * @param {Array<Object>|Object} validatorOrArray
 * @param {number} [positionInForm]
 */
function addValidation(store, fName, validatorOrArray, positionInForm) {
    const byName = store.byName || {};
    const byOrder = store.byOrder || {};
    // const focus = store.focus || {};
    byName[fName] = positionInForm;
    byOrder[positionInForm] = fName;
    Object.assign(store, { byName, byOrder });

    const fValid = `${fName}Valid`;
    const fValidationMessageComputed = `${fName}ValidationMessage`;
    const fieldValidationMessageText = `${fName}ValidationMessageText`;
    const fDirty = `${fName}Dirty`;
    const fOnChange = `${fName}OnChange`;
    const fOnBlur = `${fName}OnBlur`;
    const fieldValidators = Array.isArray(validatorOrArray) ? validatorOrArray : [validatorOrArray];

    store.validatedFields = store.validatedFields || [];
    store.validatedFields.push(fName);

    store.isValid = store.isValid || (
        () => store.validatedFields.reduce((acc, field) => acc && !!store[`${field}Valid`], true)
    );

    store.resetValidationState = store.resetValidationState || (
        () => store.validatedFields.forEach(field => {
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
    reaction(() => store[fName], async value => {
        store[fValid] = false;
        store[fieldValidationMessageText] = '';
        const validationPromises = [];
        fieldValidators.forEach(v => {
            const { action, message } = v;
            const executor = async () => {
                const result = await action(value, fName);
                if (result === true) return true;
                const errorMessage = result === false ?
                    message : result && (result.message || result);
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
        if (store[fName] !== value) return;
        store[fValid] = valid;
        store[fieldValidationMessageText] = message;
    }, true);
}


const validation = {
    validators: userValidators,
    addValidation
};

module.exports = validation;
