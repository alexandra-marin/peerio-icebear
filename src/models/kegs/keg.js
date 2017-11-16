const socket = require('../../network/socket');
const { secret, sign, cryptoUtil } = require('../../crypto');
const { AntiTamperError, ServerError } = require('../../errors');
const { observable, action } = require('mobx');
const { getContactStore } = require('../../helpers/di-contact-store');
const { getUser } = require('../../helpers/di-current-user');
const { asPromiseMultiValue } = require('../../helpers/prombservable');

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
 * @public
 * todo: convert this monstrous constructor params to object
 */
class Keg {
    constructor(id, type, db, plaintext = false, forceSign = false, allowEmpty = false, storeSignerData = false) {
        this.id = id;
        /**
         * Keg type
         * @member {string}
         * @public
         */
        this.type = type;
        /**
         * Owner KegDb instance
         * @member {KegDb}
         * @public
         */
        this.db = db;
        /**
         * Is the payload of this keg encrypted or not
         * @member {boolean}
         * @public
         */
        this.plaintext = plaintext;
        /**
         * Sometimes this specific key has to be en/decrypted with other then default for this KegDb key.
         * @member {?Uint8Array}
         * @public
         */
        this.overrideKey = null;
        /**
         * Keg format version, client tracks kegs structure changes with this property
         * @member {number}
         * @public
         */
        this.format = 0;
        /**
         * Keg collection (all kegs with this.type) version, snowflake string id.
         * null means we don't know the version yet, need to fetch keg at least once.
         * @member {?string}
         * @public
         */
        this.collectionVersion = null;
        /**
         * Default props object for default props serializers. More advanced logic usually ignores this property.
         * @member {Object}
         * @public
         */
        this.props = {};
        /**
         * @member {boolean}
         * @public
         */
        this.forceSign = forceSign;
        /**
         * @member {boolean}
         * @public
         */
        this.allowEmpty = allowEmpty;
        /**
         * @member {boolean}
         * @public
         */
        this.storeSignerData = storeSignerData;
    }

    /**
     * null when signature has not been verified yet (it's async) or it will never be because this keg is not supposed
     * to be signed.
     * @member {?boolean} signatureError
     * @memberof Keg
     * @instance
     * @public
     */
    @observable signatureError = null;
    /**
     * Indicates failure to process received/shared keg.
     * @member {?boolean} sharedKegError
     * @memberof Keg
     * @instance
     * @public
     */
    @observable sharedKegError = null;
    /**
     * @member {?string} id
     * @memberof Keg
     * @instance
     * @public
     */
    @observable id;
    /**
     * If this keg wasn't created yet, but you need to use it in a list somewhere like chat, you can call
     * `assignTempId()` and use this field as identification.
     * @member {?string} tempId
     * @memberof Keg
     * @instance
     * @public
     */
    @observable tempId;
    /**
     * Keg version, when first created and empty, keg has version === 1
     * @member {number}
     * @public
     */
    @observable version = 0;

    /**
     * @member {boolean} deleted
     * @memberof Keg
     * @instance
     * @public
     */
    @observable deleted = false;
    /**
     * @member {boolean} loading
     * @memberof Keg
     * @instance
     * @public
     */
    @observable loading = false;
    /**
     * @member {boolean} saving
     * @memberof Keg
     * @instance
     * @public
     */
    @observable saving = false;
    /**
     * Subclasses can set this to 'true' on data modification and subscribe to the flag resetting to 'false'
     * after keg is saved.
     * @member {boolean} dirty
     * @memberof Keg
     * @instance
     * @public
     */
    @observable dirty = false;
    /**
     * @member {boolean} lastLoadHadError
     * @memberof Keg
     * @instance
     * @public
     */
    lastLoadHadError = false;


    /**
     * Some kegs don't need anti-tamper checks.
     * @member {boolean} ignoreAntiTamperProtection
     * @memberof Keg
     * @instance
     */
    ignoreAntiTamperProtection;


    /**
     * Kegs with version==1 were just created and don't have any data
     * @returns {boolean}
     * @public
     */
    get isEmpty() {
        return !this.version || this.version <= 1;
    }
    /**
     * Creates unique (for session) temporary id and puts it into `tempId`
     * @public
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
     * @param {boolean=} cleanShareData - removes shared/sent keg metadata that is not needed after keg is re-encrypted.
     * @returns {Promise}
     * @public
     */
    saveToServer(cleanShareData) {
        if (this.loading) {
            console.warn(`Keg ${this.id} ${this.type} is trying to save while already loading.`);
        }
        if (this.saving) return Promise.reject(new Error('Can not save keg while it is already saving.'));
        this.saving = true;
        if (this.id) return this.internalSave(cleanShareData).finally(this.resetSavingState);

        return socket.send('/auth/kegs/create', {
            kegDbId: this.db.id,
            type: this.type
        }).then(resp => {
            this.id = resp.kegId;
            this.version = resp.version;
            this.collectionVersion = resp.collectionVersion;
            return this.internalSave(cleanShareData);
        }).finally(this.resetSavingState);
    }

    /**
     * WARNING: Don't call this directly, it will break saving workflow.
     * Updates existing server keg with new data.
     * This function assumes keg id exists so always use `saveToServer()` to be safe.
     * @returns {Promise}
     * @private
     */
    internalSave() {
        let payload, props, lastVersion, signingPromise = Promise.resolve(true);
        try {
            payload = this.serializeKegPayload();
            props = this.serializeProps();
            // existence of these properties means this keg was shared with us and we haven't re-encrypted it yet
            if (this.pendingReEncryption) {
                // we don't want to save (re-encrypt and loose original sharing data) before we validate the keg
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
        })).then(resp => {
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
     * @private
     */
    signKegPayload(payload) {
        const toSign = this.plaintext ? cryptoUtil.strToBytes(payload) : payload;
        return sign.signDetached(toSign, getUser().signKeys.secretKey).then(cryptoUtil.bytesToB64);
    }

    /**
     * (Re)populates this keg instance with data from server
     * @returns {Promise<Keg>}
     * @public
     */
    load() {
        if (this.saving) return Promise.reject(new Error('Can not load keg while it is saving.'));
        if (this.loading) return Promise.reject(new Error('Can not load keg while it is already loading.'));
        this.loading = true;
        return socket.send('/auth/kegs/get', {
            kegDbId: this.db.id,
            kegId: this.id
        })
            .catch((err) => {
                if (this.allowEmpty && err instanceof ServerError && err.code === ServerError.codes.notFound) {
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
            .then(keg => {
                const ret = this.loadFromKeg(keg);
                if (ret === false) {
                    return Promise.reject(new Error(
                        `Failed to hydrate keg id ${this.id} with server data from db ${this.db ? this.db.id : 'null'}`
                    ));
                }
                return ret;
            }).finally(this.resetLoadingState);
    }

    /**
     * Deletes the keg.
     * @returns {Promise}
     * @public
     */
    remove() {
        return socket.send('/auth/kegs/delete', {
            kegDbId: this.db.id,
            kegId: this.id
        });
    }

    /**
     * Synchronous function to rehydrate current Keg instance with data from server.
     * `load()` uses this function, you don't need to call it if you use `load()`, but in case you are requesting
     * multiple kegs from server and want to instantiate them use this function
     * after creating appropriate keg instance.
     * @param {Object} keg data as received from server
     * @returns {Keg|boolean} - returns false if keg data could not have been loaded. This function doesn't throw,
     * you have to check error flags if you received false return value.
     * @public
     */
    loadFromKeg(keg) {
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
            this.format = keg.format || this.format || 0; // this is a new field so older kegs might not have it
            this.type = keg.type || this.type; // so anti-tamper can detect it
            this.owner = keg.owner;
            this.deleted = keg.deleted;
            this.collectionVersion = keg.collectionVersion || ''; // protect from potential server bugs sending null
            if (keg.props) this.deserializeProps(keg.props);
            //  is this an empty keg? probably just created.
            if (!keg.payload) {
                if (this.allowEmpty) return this;
                this.lastLoadHadError = true;
                return false;
            }
            let payload = keg.payload;
            let payloadKey = null;

            if (!this.plaintext) {
                payload = new Uint8Array(keg.payload);
            }
            // SELF kegs do not require signing
            if (this.forceSign || (!this.plaintext && this.db.id !== 'SELF')) {
                this.verifyKegSignature(payload, keg.props);
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
            if (this.afterLoad) this.afterLoad();
            return this;
        } catch (err) {
            console.error(err, this.id);
            this.lastLoadHadError = true;
            return false;
        }
    }

    /**
     * Shared/received kegs are encrypted by sender and this function checks if keg is valid and secure
     * and re-encrypts it with own KegDb key removing sharing metadata props that's not needed anymore
     * @param {Object} kegProps
     * @private
     */
    validateAndReEncryptSharedKeg(kegProps) {
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
     * @private
     */
    verifyKegSignature(payload, props) {
        if (!payload || this.lastLoadHadError) return;
        let signature = props.signature;
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
     * @public
     * @abstract
     */
    serializeKegPayload() {
        return {};
    }

    /**
     * Generic version that does nothing.
     * Override in child classes to convert raw keg data into object properties.
     * @public
     * @abstract
     */
    // eslint-disable-next-line
    deserializeKegPayload(payload) { }

    /**
     * Generic version that uses this.props object as-is
     * @returns {Object}
     * @public
     * @abstract
     */
    serializeProps() {
        return this.props || {};
    }

    /**
     * Generic version that puts props object as-is to this.prop
     * @param {Object} props
     * @public
     * @abstract
     */
    deserializeProps(props) {
        this.props = props;
    }


    /**
     * Compares keg metadata with encrypted payload to make sure server didn't change metadata.
     * @param payload {Object} - decrypted keg payload
     * @throws AntiTamperError
     * @private
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
