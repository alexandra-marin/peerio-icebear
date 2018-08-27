export default interface IBootKeg {
    keys: {
        [keyId: string]: { key: Uint8Array; createdAt: number };
    };
    getKey(keyId: string, timeout?: number): Promise<Uint8Array>;
}
