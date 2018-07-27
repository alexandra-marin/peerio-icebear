const { observable } = require('mobx');

/**
 * Observable timer counter up/down.
 */
class Timer {
    /**
     * Observable counter you want to watch.
     * @type {number}
     */
    @observable counter = 0;

    /**
     * Starts counting from 0 to passed seconds amount, updates every second.
     * @param {any} seconds - number of seconds to count to
     */
    countUp(seconds) {
        this.counter = 0;
        this._max = Math.round(seconds);
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(this._increment, 1000);
    }
    /**
     * Starts counting from passed seconds amount to 0, updates every second.
     * @param {any} seconds - number of seconds to count from
     */
    countDown(seconds) {
        this.counter = Math.round(seconds);
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(this._decrement, 1000);
    }

    /**
     * Stops counting and resets counter to 0
     */
    stop() {
        if (this._interval) clearInterval(this._interval);
        this.counter = 0;
    }

    _increment = () => {
        if (this.counter >= this._max) {
            clearInterval(this._interval);
            return;
        }
        this.counter++;
    };

    _decrement = () => {
        if (this.counter <= 0) {
            clearInterval(this._interval);
            return;
        }
        this.counter--;
    };
}

module.exports = Timer;
