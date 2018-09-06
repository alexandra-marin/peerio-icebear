const SyncedKeg = require('../kegs/synced-keg');

class Beacons extends SyncedKeg {
    constructor(user) {
        super('beacons', user.kegDb);
        this.user = user;
    }

    serializeKegPayload() {
        const beacons = [];
        this.user.beacons.forEach((value, key) => beacons.push({ key, value }));
        return { beacons };
    }

    deserializeKegPayload(data) {
        this.user.beacons.clear();
        data.beacons.forEach(({ key, value }) => this.user.beacons.set(key, value));
    }
}

module.exports = Beacons;
