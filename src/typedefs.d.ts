// TODO: undeclare these and make them regular exports

/**
 * Object representing an asymmetric keypair.
 */
declare interface KeyPair {
    /** 32 bytes */
    publicKey: Uint8Array;
    /** 32 bytes, or 64 bytes in case of signing keypair */
    secretKey: Uint8Array;
}

/**
 * Object representing an address as server sends it.
 */
declare interface Address {
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
declare interface InvitedContact {
    email: string;
    added: number;
    username?: string;
    isAutoImport?: boolean;
}

/**
 * Object representing a 2fa UI request.
 */
declare interface TwoFARequest {
    type: 'login' | 'backupCodes' | 'disable';
    submit: (totpCode: string, trustThisDevice?: boolean) => void;
    cancel: () => void;
}
