import { observable } from 'mobx';
import SyncedKeg from '../kegs/synced-keg';

interface IAccountVersionPayload {}
interface IAccountVersionProps {
    accountVersion: number;
}
// TODO: need something more abstract here and in UI by the next migration

class AccountVersion extends SyncedKeg<IAccountVersionPayload, IAccountVersionProps> {
    constructor(user) {
        super('account_version', user.kegDb);
    }

    // current account version
    @observable accountVersion = 0;

    serializeKegPayload() {
        return {};
    }

    deserializeKegPayload(_data) {}

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
        this.saveToServer();
    }
}

export default AccountVersion;
