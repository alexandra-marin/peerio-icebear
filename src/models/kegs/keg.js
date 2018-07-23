const socket = require('../../network/socket');
const { secret, sign, cryptoUtil } = require('../../crypto');
const { AntiTamperError, ServerError } = require('../../errors');
const { observable, action } = require('mobx');
const { getContactStore } = require('../../helpers/di-contact-store');
const { getUser } = require('../../helpers/di-current-user');
const { asPromise, asPromiseMultiValue } = require('../../helpers/prombservable');
const { DecryptionError } = require('../../errors');

let temporaryKegId = 0;
function getTemporaryKegId() {
    return `tempKegId_${temporaryKegId++}`;
}
/**
 * Base class with common metadata and operations.
 * @param {?string} id - kegId, or null for new kegs
 * @param {string} type - keg type
 * @param {KegDb} db - keg database instance owning this keg
 * @param {boolean} [plaintext=false] - should keg be encrypted
 * @param {boolean} [forceSign=false] - plaintext kegs are not normally signed unless forceSign is true
 * @param {boolean} [allowEmpty=false] - normally client doesn't expect empty keg when calling `.load()` and will throw
 * @param {boolean} [storeSignerData=false] - if the keg is signed, in addition to signature it will store
 *                                            and then verify over signedByUsername prop instead of `keg.owner`.
 * todo: convert this monstrous constructor params to object
 */
class Keg {
    constructor(id, type, db, plaintext = false, forceSign = false, allowEmpty = false, storeSignerData = false) {
        this.id = id;
        /**
         * Keg type
         * @type {string}
         */
        this.type = type;
        /**
         * Owner KegDb instance
         * @type {KegDb}
         */
        this.db = db;
        /**
         * Is the payload of this keg encrypted or not
         * @type {boolean}
         */
        this.plaintext = plaintext;
        /**
         * Sometimes this specific key has to be en/decrypted with other then default for this KegDb key.
         * @type {?Uint8Array}
         */
        this.overrideKey = null;
        /**
         * Keg collection (all kegs with this.type) version, snowflake string id.
         * null means we don't know the version yet, need to fetch keg at least once.
         * @type {?string}
         */
        this.collectionVersion = null;
        /**
         * Default props object for default props serializers. More advanced logic usually ignores this property.
         * @type {Object}
         */
        this.props = {};
        /**
         * @type {boolean}
         */
        this.forceSign = forceSign;
        /**
         * @type {boolean}
         */
        this.allowEmpty = allowEmpty;
        /**
         * @type {boolean}
         */
        this.storeSignerData = storeSignerData;
    }

    /**
     * Keg format version, client tracks kegs structure changes with this property
     * @type {number}
     */
    @observable format = 0;
    /**
     * null when signature has not been verified yet (it's async) or it will never be because this keg is not supposed
     * to be signed.
     * @type {?boolean}
     */
    @observable signatureError = null;
    /**
     * Indicates failure to process received/shared keg.
     * @type {?boolean}
     */
    @observable sharedKegError = null;
    /**
     * @type {?string}
     */
    @observable id;
    /**
     * If this keg wasn't created yet, but you need to use it in a list somewhere like chat, you can call
     * `assignTempId()` and use this field as identification.
     * @type {?string}
     */
    @observable tempId;
    /**
     * Keg version, when first created and empty, keg has version === 1
     * @type {number}
     */
    @observable version = 0;

    /**
     * @type {boolean}
     */
    @observable deleted = false;
    /**
     * @type {boolean}
     */
    @observable loading = false;
    /**
     * @type {boolean}
     */
    @observable saving = false;
    /**
     * Subclasses can set this to 'true' on data modification and subscribe to the flag resetting to 'false'
     * after keg is saved.
     * @type {boolean}
     */
    @observable dirty = false;
    /**
     * Sets to true when keg is loaded for the first time.
     * @type {boolean}
     */
    @observable loaded = false;
    /**
     * @type {boolean}
     */
    lastLoadHadError = false;


    /**
     * Some kegs don't need anti-tamper checks.
     * @type {boolean}
     */
    ignoreAntiTamperProtection;


    /**
     * Kegs with version==1 were just created and don't have any data
     * @returns {boolean}
     */
    get isEmpty() {
        return !this.version || this.version <= 1;
    }
    /**
     * Creates unique (for session) temporary id and puts it into `tempId`
     */
    assignTemporaryId() {
        this.tempId = getTemporaryKegId();
    }

    resetSavingState = () => {
        this.saving = false;
    }
    resetLoadingState = () => {
        this.loading = false;
    }

    /**
     * Saves keg to server, creates keg (reserves id) first if needed
     * @returns {Promise}
     */
    saveToServer() {
        if (this.loading) {
            console.warn(`Keg ${this.id} ${this.type} is trying to save while already loading.`);
        }
        if (this.saving) {
            return asPromise(this, 'saving', false)
                .then(() => this.saveToServer());
        }
        this.saving = true;
        if (this.id) return this.internalSave().finally(this.resetSavingState);

        return socket.send('/auth/kegs/create', {
            kegDbId: this.db.id,
            type: this.type
        }, false).then(resp => {
            this.id = resp.kegId;
            this.version = resp.version;
            this.collectionVersion = resp.collectionVersion;
            return this.internalSave();
        }).finally(this.resetSavingState);
    }

    /**
     * WARNING: Don't call this directly, it will break saving workflow.
     * Updates existing server keg with new data.
     * This function assumes keg id exists so always use `saveToServer()` to be safe.
     * @returns {Promise}
     */
    internalSave() {
        let payload, props, lastVersion, signingPromise = Promise.resolve(true);
        try {
            payload = this.serializeKegPayload();
            props = this.serializeProps();
            // existence of these properties means this keg was shared with us and we haven't re-encrypted it yet
            if (this.pendingReEncryption) {
                // we don't want to save (re-encrypt and lose original sharing data) before we validate the keg
                if (this.validatingKeg) {
                    return asPromiseMultiValue(this, 'sharedKegError', [true, false])
                        .then(() => this.internalSave());
                }
                if (this.sharedKegError || this.signatureError) {
                    throw new Error('Not allowed to save a keg with sharedKegError or signatureError', this.id);
                }
                props.sharedKegSenderPK = null;
                props.sharedKegRecipientPK = null;
                props.encryptedPayloadKey = null;
            }
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
                    .tapCatch(err => console.error('Failed to sign keg', err));
            }
        } catch (err) {
            console.error('Failed preparing keg to save.', err);
            return Promise.reject(err);
        }
        lastVersion = this.version; // eslint-disable-line prefer-const
        return signingPromise.then(() => socket.send('/auth/kegs/update', {
            kegDbId: this.db.id,
            update: {
                kegId: this.id,
                keyId: this.db.keyId,
                type: this.type,
                payload: this.plaintext ? payload : payload.buffer,
                props,
                version: lastVersion + 1,
                format: this.format
            }
        }, true)).then(resp => {
            this.pendingReEncryption = false;
            this.dirty = false;
            this.collectionVersion = resp.collectionVersion;
            // in case this keg was already updated through other code paths we change version in a smart way
            this.version = Math.max(lastVersion + 1, this.version);
        });
    }

    /**
     * Sign the encrypted payload of this keg
     * @param {Uint8Array} payload
     * @returns {string} base64
     */
    signKegPayload(payload) {
        const toSign = this.plaintext ? cryptoUtil.strToBytes(payload) : payload;
        return sign.signDetached(toSign, getUser().signKeys.secretKey).then(cryptoUtil.bytesToB64);
    }

    /**
     * (Re)populates this keg instance with data from server
     * @returns {Promise<Keg>}
     */
    load() {
        if (this.saving) {
            return asPromise(this, 'saving', false).then(() => this.load());
        }
        if (this.loading) {
            return asPromise(this, 'loading', false).then(() => this.load());
        }
        this.loading = true;
        return socket.send('/auth/kegs/get', {
            kegDbId: this.db.id,
            kegId: this.id
        }, false)
            .catch((err) => {
                if (this.allowEmpty && err && err.code === ServerError.codes.notFound) {
                    // expected error for empty named kegs
                    const keg = {
                        kegId: this.id,
                        version: 1,
                        collectionVersion: '',
                        owner: '' // don't know yet
                    };
                    return keg;
                }
                return Promise.reject(err);
            })
            .then(async keg => {
                const ret = await this.loadFromKeg(keg);
                if (ret === false) {
                    const err = new Error(
                        `Failed to hydrate keg id ${this.id} with server data from db ${this.db ? this.db.id : 'null'}`
                    );
                    return Promise.reject(err);
                }
                return ret;
            }).finally(this.resetLoadingState);
    }

    /**
     * Deletes the keg.
     * @returns {Promise}
     */
    remove() {
        return socket.send('/auth/kegs/delete', {
            kegDbId: this.db.id,
            kegId: this.id
        }, false);
    }

    /**
     * Asynchronous function to rehydrate current Keg instance with data from server.
     * `load()` uses this function, you don't need to call it if you use `load()`, but in case you are requesting
     * multiple kegs from server and want to instantiate them use this function
     * after creating appropriate keg instance.
     * @param {Object} keg data as received from server
     * @returns {Promise<Keg|false>} - This function doesn't throw,
     * you have to check error flags if you received false return value.
     */
    @action async loadFromKeg(keg) {
        try {
            this.lastLoadHadError = false;
            if (this.id && this.id !== keg.kegId) {
                console.error(`Attempt to rehydrate keg(${this.id}) with data from another keg(${keg.kegId}).`);
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
            let { payload } = keg;
            let payloadKey = null;

            if (!this.plaintext) {
                payload = new Uint8Array(keg.payload);
            }
            // SELF kegs do not require signing
            if (this.forceSign || (!this.plaintext && this.db.id !== 'SELF')) {
                const payloadToVerify = payload;
                setTimeout(() => this.verifyKegSignature(payloadToVerify, keg.props), 3000);
            }
            this.pendingReEncryption = !!(keg.props.sharedBy && keg.props.sharedKegSenderPK);
            // is this keg shared with us and needs re-encryption?
            // sharedKegSenderPK is used here to detect keg that still needs re-encryption
            // the property will get deleted after re-encryption
            // we can't introduce additional flag because props are not being deleted on keg delete
            // to allow re-sharing of the same file keg
            if (!this.plaintext && this.pendingReEncryption) {
                // async call, changes state of the keg in case of issues
                this.validateAndReEncryptSharedKeg(keg.props);
                // todo: when we'll have key change, this should use secret key corresponding to sharedKegRecipientPK
                const sharedKey = getUser().getSharedKey(cryptoUtil.b64ToBytes(keg.props.sharedKegSenderPK));

                if (keg.props.encryptedPayloadKey) {
                    // Payload was encrypted with a symmetric key, which was encrypted
                    // for our public key and stored in encryptedPayloadKey prop.
                    payloadKey = secret.decrypt(cryptoUtil.b64ToBytes(keg.props.encryptedPayloadKey), sharedKey);
                }
            }
            if (!this.plaintext) {
                let decryptionKey = payloadKey || this.overrideKey;
                if (!decryptionKey) {
                    decryptionKey = this.db.boot.keys[keg.keyId || '0'];
                    if (decryptionKey) {
                        decryptionKey = decryptionKey.key;
                    }
                    if (!decryptionKey) throw new Error(`Failed to resolve decryption key for ${this.id}`);
                }
                payload = secret.decryptString(payload, decryptionKey);
            }
            payload = JSON.parse(payload);
            if (!this.ignoreAntiTamperProtection && (this.forceSign || !(this.plaintext || this.pendingReEncryption))) {
                this.detectTampering(payload);
            }
            this.deserializeKegPayload(payload);
            if (keg.props && keg.props.descriptor) this.deserializeDescriptor(keg.props.descriptor);
            if (this.afterLoad) this.afterLoad();
            this.loaded = true;
            return this;
        } catch (err) {
            console.error(err, this.id);
            // TODO: refactor this fucntion to return error code instead
            if (err instanceof DecryptionError) {
                this.decryptionError = true;
            }
            this.lastLoadHadError = true;
            return false;
        }
    }

    /**
     * Shared/received kegs are encrypted by sender and this function checks if keg is valid and secure
     * and re-encrypts it with own KegDb key removing sharing metadata props that's not needed anymore
     * @param {Object} kegProps
     */
    @action validateAndReEncryptSharedKeg(kegProps) {
        this.sharedKegError = null;
        this.signatureError = null;
        this.validatingKeg = true;
        // we need to make sure that sender's public key really belongs to him
        const contact = getContactStore().getContact(kegProps.sharedBy);
        contact.whenLoaded(action(() => {
            this.validatingKeg = false;
            if (cryptoUtil.bytesToB64(contact.encryptionPublicKey) !== kegProps.sharedKegSenderPK) {
                this.sharedKegError = true;
                this.signatureError = true;
                return;
            }
            this.sharedKegError = false;
            this.signatureError = false;
            // we don't care much if this fails because next time it will get re-saved
            this.saveToServer();
        }));
    }

    /**
     * Asynchronously checks signature.
     * @param {Uint8Array|string} payload
     * @param {Object} props
     */
    verifyKegSignature(payload, props) {
        if (!payload || this.lastLoadHadError) return;
        let { signature } = props;
        if (!signature) {
            this.signatureError = true;
            return;
        }
        signature = cryptoUtil.b64ToBytes(signature); // eslint-disable-line no-param-reassign
        let signer = this.owner;
        if (this.storeSignerData && props.signedBy) {
            signer = props.signedBy;
        }
        const contact = getContactStore().getContact(signer);
        contact.whenLoaded(() => {
            if (this.lastLoadHadError) return;
            contact.notFound ? Promise.resolve(false) :
                sign.verifyDetached(
                    this.plaintext ? cryptoUtil.strToBytes(payload) : payload, signature, contact.signingPublicKey
                ).then(r => { this.signatureError = !r; });
        });
    }

    /**
     * Generic version that provides empty keg payload.
     * Override in child classes to.
     * @returns {Object}
     * @abstract
     */
    serializeKegPayload() {
        return {};
    }

    /**
     * Generic version that does nothing.
     * Override in child classes to convert raw keg data into object properties.
     * @abstract
     */
    // eslint-disable-next-line
    deserializeKegPayload(payload) { }

    /**
     * Generic version that uses this.props object as-is
     * @returns {Object}
     * @abstract
     */
    serializeProps() {
        return this.props || {};
    }

    /**
     * Generic version that puts props object as-is to this.prop
     * @param {Object} props
     * @abstract
     */
    deserializeProps(props) {
        this.props = props;
    }


    /**
     * Compares keg metadata with encrypted payload to make sure server didn't change metadata.
     * @param payload {Object} - decrypted keg payload
     * @throws AntiTamperError
     */
    detectTampering(payload) {
        if (!payload._sys) {
            throw new AntiTamperError(`Anti tamper data missing for ${this.id}`);
        }
        if (payload._sys.kegId !== this.id) {
            throw new AntiTamperError(`Inner ${payload._sys.kegId} and outer ${this.id} keg id mismatch.`);
        }
        if (payload._sys.type !== this.type) {
            throw new AntiTamperError(`Inner ${payload._sys.type} and outer ${this.type} keg type mismatch.`);
        }
    }
}

module.exports = Keg;
