import IBootKeg from './IBootKeg';

export default interface IKegDb {
    id: string;
    key: Uint8Array;
    keyId: string;
    boot: IBootKeg;
}
