const { observable, action } = require('mobx');
const electron = require('electron').remote;

class AppState {
    @observable isFocused = false;
    @observable devModeEnabled = false;
    // network status as reported by chromium
    @observable isOnline = navigator.onLine;

    @action.bound
    changeOnlineStatus() {
        console.log(
            `Chromium reports state change to: ${
                navigator.onLine ? 'ONLINE' : 'OFFLINE'
            }`
        );
        this.isOnline = navigator.onLine;
    }

    constructor() {
        const win = electron.getCurrentWindow();
        win.on('focus', () => {
            this.isFocused = true;
            console.log('App got focus');
        });
        win.on('blur', () => {
            this.isFocused = false;
            console.log('App lost focus');
        });
        this.isFocused = win.isFocused();

        // prevents some noise in the logs on app shutdown
        window.onunload = () => win.removeAllListeners();

        window.addEventListener('online', this.changeOnlineStatus, false);
        window.addEventListener('offline', this.changeOnlineStatus, false);
    }
}

module.exports = new AppState();
