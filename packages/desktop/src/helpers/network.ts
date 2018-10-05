import { reaction, IReactionDisposer } from 'mobx';
import { socket } from 'peerio-icebear';
import appState from '../stores/app-state';

let disposer: IReactionDisposer | null = null;

// Websocket fails to properly detect connection loss and this causes noticeable
// lags when user experiences a brief disconnection or network switch. Sometimes
// websocket connection won't break even if you disable and then enable wifi in
// a few seconds. It will keep same connection but the actual data in it will
// start flowing with a big lag of 20-40 seconds. So we decide to forcibly close
// the connection when chromium reports offline event, and then reopen it when
// online event is fired.
export function start(): void {
    if (disposer) return;
    disposer = reaction(
        () => appState.isOnline,
        isOnline => {
            if (isOnline) {
                socket.open();
            } else {
                socket.close();
            }
        }
    );
}

export function stop(): void {
    if (disposer) disposer();
    disposer = null;
}
