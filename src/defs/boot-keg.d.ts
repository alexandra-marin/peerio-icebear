import Contact from '~/models/contacts/contact';
import { IObservableArray } from 'mobx';

export interface IBootKeg {
    keys: {
        [keyId: string]: { key: Uint8Array; createdAt: number };
    };
    getKey(keyId: string, timeout?: number): Promise<Uint8Array>;
    kegKey: Uint8Array;
    kegKeyId: string;
    participants?: IObservableArray<Contact>;
    admins?: IObservableArray<Contact>;
}
