import IBootKeg from '~/defs/boot-keg';
import Keg from '~/models/kegs/keg';
import { BootKegPayload } from '~/models/kegs/boot-keg';

export default interface IKegDb {
    id: string;
    key: Uint8Array;
    keyId: string;
    boot: IBootKeg;
}
