import { observable } from 'mobx';

/**
 * Observable timer counter up/down.
 */
export default class Timer {
    /**
     * Observable counter you want to watch.
     */
    @observable counter = 0;
    _max: number;
    _interval: any;
    /**
     * Starts counting from 0 to passed seconds amount, updates every second.
     * @param seconds - number of seconds to count to
     */
    countUp(seconds: number) {
        this.counter = 0;
        this._max = Math.round(seconds);
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(this._increment, 1000);
    }
    /**
     * Starts counting from passed seconds amount to 0, updates every second.
     * @param seconds - number of seconds to count from
     */
    countDown(seconds: number) {
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
