import { bulkSend } from './main';
import { EventObject } from './types';

class TelemetryStore {
    events: EventObject[] = [];

    save = (ev: EventObject) => {
        this.events.push(ev);
    };

    sendAll = () => {
        bulkSend(this.events);
        this.events = [];
    };
}

const store = new TelemetryStore();
export default store;
