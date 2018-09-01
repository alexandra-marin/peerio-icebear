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

interface AuthData {
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
    /** currently always == 'email' */
    type: string;
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
    submit: (totpCode: string, trustThisDevice?: boolean) => void;
    cancel: () => void;
}
