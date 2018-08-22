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
