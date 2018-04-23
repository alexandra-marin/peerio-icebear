/**
 * Operations contains all registered operation classes by serialized name.
 */
const operations = {};

/**
 * Registers operation with the given name.
 *
 * @param {string} name
 * @param {JobOperation} cls subclass of JobOperation to register
 */
function registerOperation(name, cls) {
    cls.prototype.__opname = name;
    operations[name] = cls;
    return cls;
}

/**
 * Unserializes operation from string and returns an operation instance.
 *
 * @param {Object} data
 */
function unserializeOperation(data) {
    const { name, props, done } = data;
    const cls = operations[name];
    if (!cls) throw new Error(`Operation ${name} not found`);
    const instance = new cls(props); // eslint-disable-line new-cap
    instance.done = done;
    return instance;
}

/**
 * Serializes operation.
 *
 * @param {JobOperation} instance instance of JobOperation subclass to serialize
 * @returns {Object}
 */
function serializeOperation(instance) {
    return {
        name: instance.__opname,
        props: instance.props,
        done: instance.done
    };
}

const fileOps = require('./file-operations');

module.exports = {
    // Helpers
    serializeOperation,
    unserializeOperation,

    // Operations
    RemoveFileOperation: registerOperation('remove-file', fileOps.RemoveFileOperation)
};
