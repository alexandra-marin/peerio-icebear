import { observable, action, when } from 'mobx';

import * as secret from '../../crypto/secret';
import * as sign from '../../crypto/sign';
import * as cryptoUtil from '../../crypto/util';
import socket from '../../network/socket';
import { getContactStore } from '../../helpers/di-contact-store';
import { getUser } from '../../helpers/di-current-user';
import { asPromise } from '../../helpers/prombservable';
import { AntiTamperError, DecryptionError, serverErrorCodes } from '../../errors';
import { IFileDescriptor } from '../files/file';
import { IKegDb } from '../../defs/interfaces';

let temporaryKegId = 0;
function getTemporaryKegId() {
    return `tempKegId_${temporaryKegId++}`;
}

interface SignedKegProps {
    signedBy?: string;
    signature?: string;
}

interface FileProps {
    descriptor?: IFileDescriptor;
}

type BaseProps = SignedKegProps & FileProps;

interface RawKegData<TProps> {
    kegId: string;
    owner: string;
    type?: string;
    keyId?: string;
    /** this is a new field so older kegs might not have it */
    format?: number;
    version: number;
    /** guard against potential server bugs sending null */
    collectionVersion: string | null;
    deleted: boolean;
    createdAt: number;
    updatedAt: number;
    props: BaseProps & TProps;
    // permissions: { users: { [username: string]: '' | 'r' | 'rw' }, groups: { [username: string]: '' | 'r' | 'rw' } }
}

// TODO: subclasses get to decide whether they're plaintext -- afaik it's not
// self-described in keg payloads or anything -- so we should maybe be exposing
// these as eg. IPlaintextKeg class-level interfaces and let
// subclasses/consumers implement those instead of having all this logic in the
// base class.

// TODO: verify the interface definitions below -- are there more fields that
// vary depending on whether the keg is plaintext or not?
export interface RawKegDataPlaintext<TProps> extends RawKegData<TProps> {
    /** The plaintext of the payload. */
    payload: string;
}

export interface RawKegDataEncrypted<TProps> extends RawKegData<TProps> {
    /** The ciphertext of the payload. */
    payload: ArrayBuffer;
}

/**
 * Base class with common metadata and operations.
 * todo: convert this monstrous constructor params to object
 */
export default class Keg<TPayload, TProps extends {} = {}> {
    /**
     * @param id kegId, or null for new kegs
     * @param type keg type
     * @param db keg database instance owning this keg
     * @param plaintext should keg be encrypted
     * @param forceSign plaintext kegs are not normally signed unless forceSign is true
     * @param allowEmpty normally client doesn't expect empty keg when calling `.load()` and will throw
     * @param storeSignerData if the keg is signed, in addition to signature it will store
     *                        and then verify over signedByUsername prop instead of `keg.owner`.
     */
    constructor(
        id: string | null,
        type: string,
        db: IKegDb,
        plaintext = false,
        forceSign = false,
        allowEmpty = false,
        storeSignerData = false
    ) {
        this.id = id;
        this.type = type;
        this.db = db;
        this.plaintext = plaintext;
        this.forceSign = forceSign;
        this.allowEmpty = allowEmpty;
        this.storeSignerData = storeSignerData;
    }

    /**
     * Keg type
     */
    type: string;

    /**
     * Owner KegDb instance
     */
    readonly db: IKegDb;

    /**
     * Is the payload of this keg encrypted or not
     */
    protected readonly plaintext: boolean;

    /**
     * Sometimes this specific key has to be en/decrypted with other then default for this KegDb key.
     */
    overrideKey: Uint8Array | null = null;

    /**
     * Keg collection (all kegs with this.type) version, snowflake string id.
     * null means we don't know the version yet, need to fetch keg at least once.
     */
    collectionVersion: string | null = null;

    /**
     * Default props object for default props serializers. More advanced logic usually ignores this property.
     */
    protected props?: BaseProps & TProps;

    protected readonly forceSign: boolean;

    protected readonly allowEmpty: boolean;

    protected readonly storeSignerData: boolean;

    protected validatingKeg: boolean | null = null;

    protected decryptionError?: unknown;

    owner?: string;
    kegCreatedAt?: number;
    kegUpdatedAt?: number;
    deserializeDescriptor?(_data: IFileDescriptor): void;
    afterLoad?: () => void;
    onLoadedFromKeg?: (keg: unknown) => void;

    /**
     * Keg format version, client tracks kegs structure changes with this property
     */
    @observable format = 0;

    @observable hidden = false;

    /**
     * null when signature has not been verified yet (it's async) or it will never be because this keg is not supposed
     * to be signed.
     */
    @observable signatureError: boolean | null = null;

    @observable id: string | null;

    /**
     * If this keg wasn't created yet, but you need to use it in a list somewhere like chat, you can call
     * `assignTempId()` and use this field as identification.
     */
    @observable tempId: string | null;

    /**
     * Keg version, when first created and empty, keg has version === 1
     */
    @observable version = 0;

    @observable deleted = false;

    @observable loading = false;

    @observable saving = false;

    /**
     * Subclasses can set this to 'true' on data modification and subscribe to the flag resetting to 'false'
     * after keg is saved.
     */
    @observable protected dirty = false;

    /**
     * Sets to true when keg is loaded for the first time.
     */
    @observable loaded = false;

    protected lastLoadHadError = false;

    /**
     * Some kegs don't need anti-tamper checks.
     */
    protected ignoreAntiTamperProtection: boolean;

    /**
     * Kegs with version==1 were just created and don't have any data
     */
    get isEmpty(): boolean {
        return !this.version || this.version <= 1;
    }

    /**
     * Creates unique (for session) temporary id and puts it into `tempId`
     */
    assignTemporaryId(): void {
        this.tempId = getTemporaryKegId();
    }

    resetSavingState = () => {
        this.saving = false;
    };
    resetLoadingState = () => {
        this.loading = false;
    };

    /**
     * Saves keg to server, creates keg (reserves id) first if needed
     */
    async saveToServer() {
        if (this.loading) {
            console.warn(`Keg ${this.id} ${this.type} is trying to save while already loading.`);
        }
        if (this.saving) {
            if (!this.id) {
                // this keg is in the process of obtaining an id, save will be inevitably called later
                return asPromise(this, 'saving', false);
            }
            await asPromise(this, 'saving', false);
        }
        this.saving = true;
        if (this.id) {
            return this.internalSave().finally(this.resetSavingState);
        }

        return socket
            .send(
                '/auth/kegs/create',
                {
                    kegDbId: this.db.id,
                    type: this.type
                },
                false
            )
            .then(resp => {
                this.id = resp.kegId;
                this.version = resp.version;
                this.collectionVersion = resp.collectionVersion;
                return this.internalSave();
            })
            .finally(this.resetSavingState);
    }

    /**
     * WARNING: Don't call this directly, it will break saving workflow.
     * Updates existing server keg with new data.
     * This function assumes keg id exists so always use `saveToServer()` to be safe.
     */
    protected async internalSave(): Promise<void> {
        let payload,
            props,
            lastVersion,
            signingPromise = Promise.resolve<void>(undefined);
        try {
            payload = this.serializeKegPayload();
            props = this.serializeProps();
            // anti-tamper protection, we do it here, so we don't have to remember to do it somewhere else
            if (!this.ignoreAntiTamperProtection && (!this.plaintext || this.forceSign)) {
                payload._sys = {
                    kegId: this.id,
                    type: this.type
                };
            }
            // server expects string or binary
            payload = JSON.stringify(payload);
            // should we encrypt the string?
            if (!this.plaintext) {
                payload = secret.encryptString(payload, this.overrideKey || this.db.key);
            }
            if (this.forceSign || (!this.plaintext && this.db.id !== 'SELF')) {
                signingPromise = this.signKegPayload(payload)
                    .then(signature => {
                        props.signature = signature;
                        if (this.storeSignerData) {
                            props.signedBy = getUser().username;
                        }
                        this.signatureError = false;
                    })
                    .tapCatch(err => console.error('Failed to sign keg', err)) as Promise<void>;
            }
        } catch (err) {
            console.error('Failed preparing keg to save.', err);
            return Promise.reject(err);
        }
        lastVersion = this.version; // eslint-disable-line prefer-const
        return signingPromise
            .then(() =>
                socket.send(
                    '/auth/kegs/update',
                    {
                        kegDbId: this.db.id,
                        update: {
                            kegId: this.id,
                            keyId: this.db.keyId,
                            type: this.type,
                            payload: this.plaintext ? payload : payload.buffer,
                            props,
                            version: lastVersion + 1,
                            format: this.format,
                            hidden: this.hidden
                        }
                    },
                    true
                )
            )
            .then(resp => {
                this.dirty = false;
                this.collectionVersion = resp.collectionVersion;
                // in case this keg was already updated through other code paths we change version in a smart way
                this.version = Math.max(lastVersion + 1, this.version);
            });
    }

    /**
     * Sign the encrypted payload of this keg
     */
    protected signKegPayload(payload: string | Uint8Array): Promise<string> {
        const toSign = this.plaintext
            ? cryptoUtil.strToBytes(payload as string)
            : (payload as Uint8Array);

        return sign.signDetached(toSign, getUser().signKeys.secretKey).then(cryptoUtil.bytesToB64);
    }

    /**
     * (Re)populates this keg instance with data from server
     */
    load() {
        if (this.saving) {
            return asPromise(this, 'saving', false).then(() => this.load());
        }
        if (this.loading) {
            return asPromise(this, 'loading', false).then(() => this.load());
        }
        this.loading = true;
        return socket
            .send(
                '/auth/kegs/get',
                {
                    kegDbId: this.db.id,
                    kegId: this.id
                },
                false
            )
            .catch(err => {
                if (this.allowEmpty && err && err.code === serverErrorCodes.notFound) {
                    // expected error for empty named kegs
                    const keg = {
                        kegId: this.id,
                        version: 1,
                        collectionVersion: '',
                        owner: '' // don't know yet
                    };
                    return keg;
                }
                return err;
            })
            .then(async keg => {
                const ret = await this.loadFromKeg(keg);
                if (ret === false) {
                    const err = new Error(
                        `Failed to hydrate keg id ${this.id} with server data from db ${
                            this.db ? this.db.id : 'null'
                        }`
                    );
                    return Promise.reject(err);
                }
                return ret;
            })
            .finally(this.resetLoadingState);
    }

    /**
     * Deletes the keg.
     */
    protected remove(flags?: object) {
        return socket.send(
            '/auth/kegs/delete',
            {
                kegDbId: this.db.id,
                kegId: this.id
            },
            false
        );
    }

    /**
     * Asynchronous function to rehydrate current Keg instance with data from server.
     * `load()` uses this function, you don't need to call it if you use `load()`, but in case you are requesting
     * multiple kegs from server and want to instantiate them use this function
     * after creating appropriate keg instance.
     *
     * @param keg data as received from server
     * @param noVerify prevents signature verification (for example, when loading cached keg)
     * @returns returns false if keg data could not have been loaded.
     *                  This function doesn't throw, you have to check error
     *                  flags if you received false return value.
     */
    @action
    async loadFromKeg(
        keg: RawKegDataPlaintext<TProps> | RawKegDataEncrypted<TProps>,
        noVerify = false
    ): Promise<this | false> {
        try {
            this.lastLoadHadError = false;
            if (this.id && this.id !== keg.kegId) {
                console.error(
                    `Attempt to rehydrate keg(${this.id}) with data from another keg(${keg.kegId}).`
                );
                this.lastLoadHadError = true;
                return false;
            }
            // empty kegs (esp. named) have a potential to overwrite values so we do it carefully
            this.id = keg.kegId;
            this.version = keg.version;
            this.format = keg.format || 0; // this is a new field so older kegs might not have it
            this.type = keg.type || this.type; // so anti-tamper can detect it
            this.owner = keg.owner;
            this.deleted = keg.deleted;
            this.collectionVersion = keg.collectionVersion || ''; // protect from potential server bugs sending null
            this.kegCreatedAt = keg.createdAt;
            this.kegUpdatedAt = keg.updatedAt;
            if (keg.props) this.deserializeProps(keg.props);
            //  is this an empty keg? probably just created.
            if (!keg.payload) {
                if (this.allowEmpty) {
                    this.loaded = true;
                    return this;
                }
                this.lastLoadHadError = true;
                return false;
            }

            // TODO: refactor this! needs simpler code paths for plainText kegs
            // vs. encrypted kegs, as a first step to simplifying the tangled
            // nest of conditionals below.

            let binPayload: Uint8Array;
            let stringPayload: string;

            if (this.plaintext) {
                stringPayload = keg.payload as string;
            } else {
                binPayload = new Uint8Array(keg.payload as ArrayBuffer);
            }
            // SELF kegs do not require signing
            if (!noVerify && (this.forceSign || (!this.plaintext && this.db.id !== 'SELF'))) {
                setTimeout(() => this.verifyKegSignature(binPayload, keg.props), 3000);
            } else {
                this.signatureError = false;
            }
            if (!this.plaintext) {
                let decryptionKey: Uint8Array = this.overrideKey;
                if (!decryptionKey) {
                    const keyObj = this.db.boot.keys[keg.keyId || '0']; // optimization, avoids async
                    if (keyObj) decryptionKey = keyObj.key;
                    if (!decryptionKey) {
                        decryptionKey = await this.db.boot.getKey(keg.keyId || '0');
                    }
                    if (!decryptionKey) {
                        throw new Error(`Failed to resolve decryption key for ${this.id}`);
                    }
                }
                stringPayload = secret.decryptString(binPayload, decryptionKey);
            }
            const payload = JSON.parse(stringPayload); // FIXME: introduce new field to fix this

            if (!this.ignoreAntiTamperProtection && (this.forceSign || !this.plaintext)) {
                this.detectTampering(payload);
            }
            this.deserializeKegPayload(payload);
            if (keg.props && keg.props.descriptor) this.deserializeDescriptor(keg.props.descriptor);
            if (this.afterLoad) this.afterLoad();
            this.loaded = true;
            // TODO: not proud of this, looking for better ideas to get the raw keg from here to interested party
            if (this.onLoadedFromKeg) this.onLoadedFromKeg(keg);
            return this;
        } catch (err) {
            console.error(err, this.id);
            // TODO: refactor this function to return error code instead
            if (err instanceof DecryptionError) {
                this.decryptionError = true;
            }
            this.lastLoadHadError = true;
            return false;
        }
    }

    /**
     * Asynchronously checks signature.
     */
    verifyKegSignature(payload: Uint8Array | string, props: SignedKegProps): void {
        if (!payload || this.lastLoadHadError) return;
        try {
            const { signature } = props;
            if (!signature) {
                this.signatureError = true;
                return;
            }
            const signatureBytes = cryptoUtil.b64ToBytes(signature);
            let signer = this.owner;
            if (this.storeSignerData && props.signedBy) {
                signer = props.signedBy;
            }
            const contact = getContactStore().getContact(signer);
            contact.whenLoaded(async () => {
                if (this.lastLoadHadError || contact.notFound) {
                    this.signatureError = true;
                    return;
                }
                try {
                    const data = this.plaintext
                        ? cryptoUtil.strToBytes(payload as string) // TODO: audit "plaintext" flag strategy for type-safety
                        : (payload as Uint8Array);
                    const res = await sign.verifyDetached(
                        data,
                        signatureBytes,
                        contact.signingPublicKey
                    );
                    this.signatureError = !res;
                } catch (err) {
                    console.error(err);
                    this.signatureError = true;
                }
            });
        } catch (err) {
            console.error(err);
            this.signatureError = true;
        }
    }

    // //////////////////////
    // //////////////////////
    // TODO: the below are "abstract-ish" methods -- having a base
    // implementation might not actually be desirable vs just declaring the
    // default behaviour in subclasses where it's really necessary and wanted.
    //
    // more generally, abstract methods don't... super make sense in the context
    // of a duck-typed language -- doubly when interfaces are available as a
    // language feature. these should maybe be deprecated in favour of a more
    // composable abstraction.
    // //////////////////////
    // //////////////////////

    /**
     * Generic version that provides empty keg payload.
     * Override in child classes to.
     */
    protected serializeKegPayload(): TPayload {
        return {} as TPayload;
    }

    /**
     * Generic version that does nothing.
     * Override in child classes to convert raw keg data into object properties.
     */
    protected deserializeKegPayload(_payload: TPayload): void {}

    /**
     * Generic version that uses this.props object as-is
     */
    protected serializeProps(): TProps {
        return this.props || ({} as TProps);
    }

    /**
     * Generic version that puts props object as-is to this.prop
     */
    protected deserializeProps(props: TProps) {
        this.props = props;
    }

    /**
     * Compares keg metadata with encrypted payload to make sure server didn't change metadata.
     * @param payload decrypted keg payload
     * @throws AntiTamperError
     */
    protected detectTampering(payload: { _sys: { kegId: string; type: string } }): void {
        if (!payload._sys) {
            throw new AntiTamperError(`Anti tamper data missing for ${this.id}`);
        }
        if (payload._sys.kegId !== this.id) {
            throw new AntiTamperError(
                `Inner ${payload._sys.kegId} and outer ${this.id} keg id mismatch.`
            );
        }
        if (payload._sys.type !== this.type) {
            throw new AntiTamperError(
                `Inner ${payload._sys.type} and outer ${this.type} keg type mismatch.`
            );
        }
    }

    protected onceVerified(callback: () => void): void {
        when(() => this.signatureError !== null, callback);
    }
}
