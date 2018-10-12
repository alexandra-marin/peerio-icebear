import { action } from 'mobx';
import SyncedKeg from '../kegs/synced-keg';
import User from './user';

interface IBeaconsPayload {
    [key: string]: boolean;
}

export default class Beacons extends SyncedKeg<IBeaconsPayload, {}> {
    constructor(user: User) {
        super('beacons', user.kegDb);
        this.user = user;
    }
    user: User;

    serializeKegPayload(): IBeaconsPayload {
        return this.user.beacons.toPOJO();
    }

    @action
    deserializeKegPayload(data: IBeaconsPayload) {
        this.user.beacons.clear();
        this.user.beacons.merge(data);
    }
}
