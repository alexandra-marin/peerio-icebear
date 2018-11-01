import Contact from '../models/contacts/contact';

// TODO: some of these could probably be split out and moved closer to their
// usage sites

/**
 * Object representing an asymmetric keypair.
 */
export interface KeyPair {
    /** 32 bytes */
    publicKey: Uint8Array;
    /** 32 bytes, or 64 bytes in case of signing keypair */
    secretKey: Uint8Array;
}

export interface AuthToken {
    token: Uint8Array;
    nonce: Uint8Array;
    ephemeralServerPK: Uint8Array;
}

export interface AuthData {
    username: string;
    paddedPassphrase: string;
    passphrase?: string;
    authSalt: string;
    bootKey: string;
    authKeys: { secretKey: string; publicKey: string };
}

export interface AccountCreationChallenge {
    username: string;
    ephemeralServerPK: ArrayBuffer;
    signingKey: { token: ArrayBuffer };
    authKey: {
        token: ArrayBuffer;
        nonce: ArrayBuffer;
    };
    encryptionKey: {
        token: ArrayBuffer;
        nonce: ArrayBuffer;
    };
}
export interface AccountCreationChallengeConverted {
    username: string;
    ephemeralServerPK: Uint8Array;
    signingKey: { token: Uint8Array };
    authKey: {
        token: Uint8Array;
        nonce: Uint8Array;
    };
    encryptionKey: {
        token: Uint8Array;
        nonce: Uint8Array;
    };
}
/**
 * Object representing an address as server sends it.
 */
export interface Address {
    address: string;
    confirmed: boolean;
    primary: boolean;
    type: 'email';
}

/**
 * Object representing an invited contact.
 * Username appears when invited contact joins Peerio.
 */
export interface InvitedContact {
    email: string;
    added: number;
    username?: string;
    isAutoImport?: boolean;
}

/**
 * Object representing a 2fa UI request.
 */
export interface TwoFARequest {
    type: 'login' | 'backupCodes' | 'disable';
    submit: (totpCode: string, trustThisDevice?: boolean) => Promise<void>;
    cancel: () => void;
}

export interface IBootKeg {
    getKey(keyId: string, timeout?: number): Promise<Uint8Array>;
    keys: { [keyId: string]: { key: Uint8Array } };
    loaded: boolean;
    owner?: string;
}

// TODO: this is a mix of KegDb and SharedKegDb,
// not very accurate in terms of members that exist in one but not in another
// but anything else I tried was a nightmare at this point
export interface IKegDb {
    id: string;
    key: Uint8Array;
    keyId: string;
    boot: IBootKeg;
    createBootKeg?(): Promise<any>;
    participants?: Array<Contact>;
}
