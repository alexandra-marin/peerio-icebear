import IBootKeg from '~/defs/boot-keg';

export default interface IKegDb {
    id: string;
    key: Uint8Array;
    keyId: string;
    boot: IBootKeg;
}
