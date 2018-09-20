import { EventObject } from './types';

class TelemetryStore {
    events: EventObject[] = [];

    save = (ev: EventObject) => {
        this.events.push(ev);
    };
}

const store = new TelemetryStore();
export default store;
