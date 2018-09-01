const SyncedKeg = require('../kegs/synced-keg');

class Beacons extends SyncedKeg {
    constructor(user) {
        super('beacons', user.kegDb);
        this.user = user;
    }

    serializeKegPayload() {
        return {
            beacons: this.user.beacons
        };
    }

    deserializeKegPayload(data) {
        this.user.beacons = data.beacons;
    }
}

module.exports = Beacons;
