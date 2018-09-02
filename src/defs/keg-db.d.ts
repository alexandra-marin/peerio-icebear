import Keg from '~/models/kegs/keg';
import BootKeg, { BootKegPayload } from '~/models/kegs/boot-keg';
import SharedDbBootKeg from '~/models/kegs/shared-db-boot-keg';

export default interface IKegDb {
    id: string;
    key: Uint8Array;
    keyId: string;
    boot: BootKeg | SharedDbBootKeg;
}
