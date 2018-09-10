import { Atom } from 'mobx';
import config from '../config';

/**
 * Observable clock.
 * Provides clock.now property that is mobx observable and changes at specified time interval.
 * Doesn't tick when no one is observing.
 * Create your own clock or use default one.
 */
export default class Clock {
    /**
     * @param interval - clock update interval in seconds
     */
    constructor(interval: number) {
        this._atom = new Atom('Clock', this._startTicking, this._stopTicking);
        this._interval = interval;
    }

    _atom: Atom;
    _intervalHandle: any = null;
    _lastTickValue: number;
    _interval: number;
    /**
     * Default clock instance with `config.observableClockEventFrequency` interval
     */
    static default: Clock;

    /**
     * Current timestamp. Observable. Updates every `this.interval` seconds
     */
    get now(): number {
        if (this._atom.reportObserved()) {
            return this._lastTickValue;
        }
        return Date.now(); // in case this call is regular one, not observed
    }

    /**
     * Stops the clock, it can't be restarted after this.
     */
    dispose() {
        this._stopTicking();
        this._atom = null;
    }

    _tick = () => {
        this._lastTickValue = Date.now();
        this._atom.reportChanged();
    };

    _startTicking = () => {
        this._tick(); // initial tick
        this._intervalHandle = setInterval(this._tick, this._interval * 1000);
    };

    _stopTicking = () => {
        clearInterval(this._intervalHandle);
        this._intervalHandle = null;
    };
}

Clock.default = new Clock(config.observableClockEventFrequency);
