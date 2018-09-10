/**
 * Main connection SocketClient instance.
 *
 * Normally this is the only instance you should use.
 * It gets connection url from config and you have to call socket.start()
 * once everything is ready.
 */

import SocketClient from './socket-client';
import config from '../config';

const socket = new SocketClient();

const wrappedStart = socket.start;

socket.start = function() {
    wrappedStart.call(socket, config.socketServerUrl);
};

export default socket;
