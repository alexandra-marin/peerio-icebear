/**
 * Placeholder of things to come, and also makes the dev aware that
 * a store is related to ValidatedInputs on the component.
 */
const { extendObservable, observable, computed } = require('mobx');
const _ = require('lodash');

class OrderedFormStore {
    /**
     * kv pairs of field name and ValidatedInput component
     *
     * @type {Array}
     */
    fields = {};
    /**
     * Set to true once all fields have rendered and the store has been initialized.
     * May be useful to trigger computed() which contains observables
     * that rely on observables created by ValidatedInput -- ie. they would
     * not have been available on creation of the store.
     *
     * @type {boolean}
     */
    @computed
    get initialized() {
        const fieldsExpected = this.fieldsExpected || 0;

        return this.fieldsInitialized >= fieldsExpected;
    }

    /**
     *  Number of fields initialized, set by addField.
     * @type {number}
     */
    @observable fieldsInitialized = 0;

    /**
     * Populated (optionally) by validated inputs in order to mark fields
     * that precede another field to be marked as dirty.
     *
     * @type {Object}
     */
    fieldOrders = {};

    /**
     * Adds a field and initializes functions and observables related to it.
     *
     * @param {String} fieldName
     * @param {ValidatedInput} validatedInputComponent
     * @param {Number} position
     */
    addField(fieldName, validatedInputComponent, position) {
        this.fields[fieldName] = validatedInputComponent;
        // attach validation function for easy calling
        const validationFnName = _.camelCase(`validate_${fieldName}`);
        this[validationFnName] = validatedInputComponent.validateConnected.bind(
            validatedInputComponent
        );
        // adds additional observables to the store
        const validationProps = {};
        validationProps[`${fieldName}Valid`] = false;
        validationProps[`${fieldName}Dirty`] = false;
        validationProps[`${fieldName}Focused`] = false;
        validationProps[`${fieldName}ValidationMessageText`] = '';
        extendObservable(this, validationProps);
        // add the field order
        this.fieldOrders[fieldName] = position;
        // alert the store that the above are available -- use in computeds
        this.fieldsInitialized += 1;
    }
}

module.exports = OrderedFormStore;
