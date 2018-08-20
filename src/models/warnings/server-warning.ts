import { has as isKnownKey } from 'peerio-translator';
import { retryUntilSuccess } from '../../helpers/retry';
import socket from '../../network/socket';
import SystemWarning, { WarningLevel } from './system-warning';

/**
 * warning object as received from server
 */
export interface ServerWarningData {
    /**
     * translation key starting with `serverWarning_` for security any other keys will be ignored
     */
    msg: string;
    /**
     * same as 'msg' but for dialog title
     */
    title: string;

    level: WarningLevel;
    /**
     * unique id of this warning to send it back and dismiss this warning
     */
    token: string;
}

/**
 * Server warning. Server sends locale key and severity level for client to display.
 * You don't need to create instances of this class, Icebear takes care of it.
 */
export default class ServerWarning extends SystemWarning {
    /**
     * to use when dismissing/acknowledging server message
     */
    token: string;
    onClear?: () => void;

    /**
     * Server warning. Server sends locale key and severity level for client to display.
     * You don't need to create instances of this class, Icebear takes care of it.
     * @param obj warning object as received from server
     * @param onClear callback will be called when warning is successfully dismissed on server
     */
    constructor(obj: ServerWarningData, onClear?: () => void) {
        if (!obj || !obj.msg || !obj.msg.startsWith('serverWarning_') || !isKnownKey(obj.msg)) {
            console.debug(obj);
            throw new Error(`Invalid/unknown warning key '${obj.msg}' received from server.`);
        }
        super(obj.msg, obj.title, null, obj.level);
        this.token = obj.token;
        this.onClear = onClear;
    }

    dispose() {
        return retryUntilSuccess(() =>
            socket.send('/auth/warning/clear', {
                token: this.token
            })
        ).then(() => {
            if (this.onClear) this.onClear();
        });
    }
}
