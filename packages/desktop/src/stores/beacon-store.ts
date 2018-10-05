import { action, computed, observable } from 'mobx';
import { User } from 'peerio-icebear';
import {
    addActivityListener,
    removeActivityListener,
    addActivityListenerWithoutMouseMovement
} from '~/helpers/activity-listeners';

class BeaconStore {
    // Beacons in queue to be shown to user.
    // 0th item is currently visible.
    @observable currentBeacons: string[] = [];

    @computed
    get activeBeacon() {
        if (!this.currentBeacons.length) return null;
        return this.currentBeacons[0];
    }

    // "Advances" the beacon flow by removing the 0th entry
    // Optionally, pass the name of the beacon that needs to be activeBeacon in orderto trigger the increment
    @action.bound
    increment(beacon?: string) {
        if (!this.currentBeacons.length) return;
        if (!!beacon && this.activeBeacon !== beacon) return;

        // Mark activeBeacon as seen in User beacons
        this.markAsRead(this.activeBeacon);

        // Remove activeBeacon from currentBeacons array
        this.currentBeacons.shift();
    }

    // Increment but with a delay passed from component.
    // Optionally, also pass the name of the beacon that needs to be activeBeacon in order to trigger the increment.
    // Delay is reset on user activity (key press, mouse click, mouse movement)
    @observable incrementTimer: NodeJS.Timer;
    @observable incrementDelay: number;
    @observable incrementOnActiveBeacon: string;

    @action.bound
    queueIncrement(delay: number, beacon?: string) {
        this.incrementDelay = delay;
        this.incrementOnActiveBeacon = beacon;
        this.setIncrementTimer();
        addActivityListener(this.setIncrementTimer);
    }

    @action.bound
    setIncrementTimer() {
        if (this.incrementTimer) clearTimeout(this.incrementTimer);
        this.incrementTimer = setTimeout(() => {
            this.increment(this.incrementOnActiveBeacon);
            this.clearIncrementQueue();
        }, this.incrementDelay);
    }

    @action.bound
    clearIncrementQueue() {
        if (this.incrementTimer) {
            clearTimeout(this.incrementTimer);
            this.incrementTimer = null;
        }
        this.incrementTimer = null;
        this.incrementDelay = null;
        this.incrementOnActiveBeacon = null;
        removeActivityListener(this.setIncrementTimer);
    }

    // Mark beacons as read in the user's profile so user is not shown beacons they have dismissed before
    async markAsRead(b: string | string[]): Promise<void> {
        if (typeof b === 'string') {
            User.current.beacons.set(b, true);
        } else {
            b.forEach(beacon => {
                User.current.beacons.set(beacon, true);
            });
        }
        await User.current.saveBeacons();
    }

    // Add beacons to the currentBeacons array. Argument can be string (single beacon) or array (multiple).
    addBeacons = (b: string | string[]): void => {
        if (typeof b === 'string') {
            this.pushBeacon(b);
        } else {
            b.forEach(beacon => {
                this.pushBeacon(beacon);
            });
        }
    };

    // Push to currentBeacons but check beacon read status in User profile first.
    // This is not intended to be called directly. Component should use addBeacons.
    @action.bound
    private async pushBeacon(b: string): Promise<void> {
        const beaconStatus = await User.current.beacons.get(b);
        if (!beaconStatus) {
            this.currentBeacons.push(b);
        }
    }

    // Clear currentBeacons, e.g. if switching to a different beacon flow
    @action.bound
    clearBeacons(): void {
        this.currentBeacons = [];
    }

    // Adding beacons with a delay
    @observable beaconsInQueue: string[] = [];
    @observable beaconDelay: number;

    @action.bound
    queueBeacons(b: string | string[], delay: number) {
        if (typeof b === 'string') {
            this.beaconsInQueue = [b];
        } else {
            this.beaconsInQueue = b;
        }
        this.beaconDelay = delay;
        this.setBeaconTimer();
        addActivityListener(this.setBeaconTimer);
    }

    @action.bound
    clearQueuedBeacons() {
        if (this.beaconTimer) {
            clearTimeout(this.beaconTimer);
            this.beaconTimer = null;
        }
        this.beaconsInQueue = [];
        this.beaconDelay = 0;
        removeActivityListener(this.setBeaconTimer);
    }

    @observable beaconTimer: NodeJS.Timer;
    @action.bound
    setBeaconTimer() {
        if (this.beaconTimer) clearTimeout(this.beaconTimer);
        this.beaconTimer = setTimeout(() => {
            this.addBeacons(this.beaconsInQueue);
            this.clearQueuedBeacons();
        }, this.beaconDelay);
    }

    // First beacon has different rules from the other queued beacons.
    // Identical except user activity listeners do *not* include mouse movement.
    queueFirstBeacon(b: string | string[], delay: number) {
        if (typeof b === 'string') {
            this.beaconsInQueue = [b];
        } else {
            this.beaconsInQueue = b;
        }
        this.beaconDelay = delay;
        this.setBeaconTimer();
        addActivityListenerWithoutMouseMovement(this.setBeaconTimer);
    }
}

const store = new BeaconStore();
export default store;
