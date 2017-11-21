const { retryUntilSuccess } = require('../../helpers/retry');
const isKnownKey = require('peerio-translator').has;
const SystemWarning = require('./system-warning');
const socket = require('../../network/socket');


/**
 * Server warning. Server sends locale key and severity level for client to display.
 * You don't need to create instances of this class, Icebear takes care of it.
 * @param {Object} obj - warning object as received from server
 * @param {string} obj.msg - translation key starting with `serverWarning_` for security any other keys will be ignored
 * @param {string} obj.title - same as 'msg' but for dialog title
 * @param {string} obj.level - 'medium' or 'severe'
 * @param {string} obj.token - unique id of this warning to send it back and dismiss this warning
 * @param {function} onClear - callback will be called when warning is successfully dismissed on server
 * @protected
 */
class ServerWarning extends SystemWarning {
    constructor(obj, onClear) {
        if (!obj || !obj.msg || !obj.msg.startsWith('serverWarning_') || !isKnownKey(obj.msg)) {
            console.debug(obj);
            throw new Error(`Invalid/unknown warning key '${obj.msg}' received from server.`);
        }
        super(obj.msg, obj.title, null, obj.level);
        this.token = obj.token; // to use when dismissing/acknowledging server message
        this.onClear = onClear;
    }

    dispose() {
        return retryUntilSuccess(() => socket.send('/auth/warning/clear', { token: this.token }))
            .then(() => {
                if (this.onClear) this.onClear();
            });
    }
}

module.exports = ServerWarning;
