// const { observable } = require('mobx');
const SyncedKeg = require('../kegs/synced-keg');

// TODO: need something more abstract here and in UI by the next migration

class AccountVersion extends SyncedKeg {
    // current account version
    accountVersion = 0;
    // migration specific data
    migration = {};

    constructor(db) {
        super('account_version', db);
    }

    serializeKegPayload() {
        return {
            migration: JSON.stringify(this.migration)
        };
    }

    deserializeKegPayload(data) {
        this.confirmed = data.confirmed;
        this.migration = JSON.parse(data.migration);
    }

    serializeProps() {
        return {
            accountVersion: this.accountVersion
        };
    }

    deserializeProps(data) {
        this.accountVersion = data.accountVersion;
    }

    __reset() {
        this.accountVersion = 0;
        this.migration = {};
        this.saveToServer();
    }
}

module.exports = AccountVersion;
