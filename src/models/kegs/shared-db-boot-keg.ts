import * as cryptoUtil from '../../crypto/util';
import * as publicCrypto from '../../crypto/public';
import * as cryptoKeys from '../../crypto/keys';
import { action, observable, when } from 'mobx';
import { getContactStore } from '../../helpers/di-contact-store';
import SyncedKeg from '../kegs/synced-keg';
import User from '../user/user';
import SharedKegDb from './shared-keg-db';
import Contact from '../contacts/contact';
import { IObservableArray } from 'mobx/lib/types/observablearray';
import { IBootKeg } from '~/defs/interfaces';

interface ISharedDbBootKegPayload {
    publicKey: string;
    roles: {
        [roleName: string]: string[];
    };
    encryptedKeys: IEncryptedKeys;
}
interface ISharedDbBootKegProps {}

interface IEncryptedKeys {
    [keyId: string]: {
        createdAt: number;
        keys: {
            [username: string]: {
                key: string; //b64
                publicKey: string; //b64
            };
        };
    };
}
/**
 * Named plaintext Boot keg for shared keg databases.
 *
 * Payload format version 1:
 * ```
 * {
 *   publicKey: b64 encoded buffer,
 *   encryptedKeys: {
 *           username: b64 encoded buffer, // encrypted for user's PK
 *           username1: b64 encoded buffer
 *         }
 * }
 * ```
 *
 * Payload format version 2:
 * ```
 * {
 *   publicKey: b64 encoded buffer, // public key from the encrypting ephemeral pair
 *   roles: {
 *      admin: ["username", "username1", ...],
 *      some_role_we_will_want_later: ["username"]
 *   },
 *   // object key = incremental key id
 *   encryptedKeys: {
 *      "0": {
 *              createdAt: number
 *              keys: {
 *                 // key id
 *                 username: {
 *                     key: b64 encoded buffer, // encrypted for user's PK
 *                     publicKey: b64 encoded buffer // user's public key (so user can still
 *                                                   // decrypt this after she changes her keys)
 *                 }
 *                 username1: {...}
 *              }
 *           },
 *      "1": {
 *           ...
 *         }
 *   }
 * }
 * ```
 *
 *  1. Adding someone to the shared db with full history access
 *      - Create new 'username:encryptedKey' record in the most ALL key object
 *      - for this generate new ephemeral key pair, and re-encrypt all the stuff
 *      - Send a system message 'username was invited'
 *     At this point, invited user has full normal access to this keg db, BUT doesn't receive any notifications
 *     push or keg notifications. As user now has full access to the keg db she will infer invitation status
 *     from the special keg described below.
 * 2. Revoking invite or removing user from the shared db
 *      - Delete the record for this user from ALL keys
 *      - Server deletes invite_status-username keg
 * 3. Accepting an invitation
 *      - invited user creates/undeletes invite_status-username keg with accepted:true property in it
 *      Server enables notifications when joined:true.
 * 4. Leaving a shared db
 *      - participant sets joined:false
 *      - admin removes user from boot keg
 *
 * invite_status keg
 * ```
 * {
 *   accepted: boolean
 * }
 * ```
 *
 * @param db - owner instance
 * @param user - currently authenticated user
 */
class SharedDbBootKeg extends SyncedKeg<ISharedDbBootKegPayload, ISharedDbBootKegProps>
    implements IBootKeg {
    constructor(db: SharedKegDb, user: User) {
        // named kegs are pre-created, so we know the id already and only going to update boot keg
        super('boot', db, true, true, true, true);
        this.ignoreAntiTamperProtection = true;
        this.user = user;
        this.version = 1; // pre-created named keg
        this.format = 1;
        this.latestFormat = this.format;
    }

    encryptedKeys: IEncryptedKeys;
    publicKey: Uint8Array;

    latestFormat: number;
    user: User;
    /**
     * Extracted from payload, most recent key to use for encryption.
     * The trick here is that this property will only get updated after new keg key
     * if it was added, is successfully saved to server.
     */
    kegKey: Uint8Array;
    /**
     * Most recent key id
     */
    kegKeyId: string;
    /**
     * Extracted from payload to use for decryption.
     */
    @observable.shallow keys: { [keyId: string]: { createdAt: number; key: Uint8Array } } = {};

    /**
     * List of usernames who have access to the shared DB currently.
     * This includes users pending join confirmation.
     */
    @observable.shallow participants = [] as IObservableArray<Contact>;

    /**
     * Subset of `this.participants`.
     */
    @observable.shallow admins = [] as IObservableArray<Contact>;

    /**
     * Gives access to shared DB keys to a contact.
     */
    addParticipant(contact: Contact) {
        if (this.participants.includes(contact)) return;
        this.participants.push(contact);
    }

    /**
     * Gives access to shared DB keys to a contact.
     */
    removeParticipant(contact: Contact) {
        this.participants.remove(contact);
    }

    /**
     * Adds a new key, deprecating current key, or initializes empty boot keg with the first key.
     */
    addKey() {
        if (this.dirty)
            throw new Error('Can not add key to shared db boot keg because unsaved key exists.');
        // NOTE: if this is not the first key, we intentionally do not update `this.kegKey` and `this.kegKeyId`,
        // because it's dangerous to encrypt with the key that has not been saved yet.
        // Fields will get updated after boot keg is saved and reloaded.
        const key = cryptoKeys.generateEncryptionKey();
        const ids = Object.keys(this.keys).map(id => +id);
        const maxId = (ids.length ? Math.max(...ids) + 1 : 0).toString();
        this.keys[maxId] = {
            createdAt: Date.now(),
            key
        };
        this.dirty = true;
        if (maxId === '0') {
            this.kegKey = this.keys[maxId].key;
            this.kegKeyId = maxId;
        }
    }

    /**
     * This is a helper method to perform rollback after failed keg save.
     */
    removeUnsavedKey() {
        const ids = Object.keys(this.keys).map(id => +id);
        const maxId = ids.length ? Math.max(...ids) + 1 : 0;
        if (+this.kegKeyId < maxId) {
            delete this.keys[maxId.toString()];
            this.dirty = false;
        }
    }

    /**
     * Waits until keyId is available and resolves with it.
     * If the key will not appear in the timeout time, resolves to undefined.
     */
    async getKey(keyId: string, timeout = 120000): Promise<Uint8Array> {
        if (this.keys[keyId]) {
            // quick path
            return this.keys[keyId].key;
        }
        let resolve;
        const promise = new Promise(_resolve => {
            resolve = _resolve;
        });
        const disposeReaction = when(() => !!this.keys[keyId], resolve);
        await promise.timeout(timeout).catch(() => {
            disposeReaction();
        });
        return this.keys[keyId] ? this.keys[keyId].key : null;
    }

    /**
     * Overrides SyncedKeg#onSaved
     */
    onSaved() {
        const ids = Object.keys(this.keys).map(id => +id);
        const maxId = Math.max(...ids).toString();
        this.kegKey = this.keys[maxId].key;
        this.kegKeyId = maxId;
    }

    /**
     * Assigns a role to shared db participant
     * @param contact - contact to assign a role to
     * @param role - currently can be only 'admin'
     */
    assignRole(contact: Contact, role: string) {
        if (role !== 'admin') throw new Error('Only admin role is currently supported');
        if (!this.admins.includes(contact)) {
            // should not happen, but just to be safe
            const duplicate = this.admins.filter(d => d.username === contact.username);
            duplicate.forEach(d => this.admins.remove(d));

            this.admins.push(contact);
        }
    }
    /**
     * Removes role from a participant
     */
    unassignRole(contact: Contact, role: string) {
        if (role !== 'admin') throw new Error('Only admin role is currently supported.');
        // we do it this way to prevent potential errors around contacts that failed to load for whatever reason,
        if (!this.admins.includes(contact)) return;
        if (this.admins.length < 2) throw new Error('Can not remove last admin from boot keg.');
        this.admins.remove(contact);
    }

    deserializeKegPayload(data) {
        if (this.format === 1) {
            this.deserializeKegPayloadFormat1(data);
        } else {
            this.deserializeKegPayloadFormat0(data);
        }
    }

    deserializeKegPayloadFormat0(data) {
        // keys for every participant
        this.encryptedKeys = data.encryptedKeys;
        // public key from ephemeral key pair that encrypted keys
        this.publicKey = cryptoUtil.b64ToBytes(data.publicKey);
        // decrypting keg key that was encrypted for me
        let kegKey = data.encryptedKeys[this.user.username];
        kegKey = cryptoUtil.b64ToBytes(kegKey);
        kegKey = publicCrypto.decrypt(kegKey, this.publicKey, this.user.encryptionKeys.secretKey);
        if (kegKey === false) {
            console.error('Failed to decrypt shared db key for myself.');
            // todo: mark as invalid to prevent message loading attempts?
            return;
        }
        this.kegKey = kegKey;
        this.kegKeyId = '0';
        this.keys[this.kegKeyId] = { key: this.kegKey, createdAt: Date.now() };
    }

    @action.bound
    deserializeKegPayloadFormat1(data) {
        this.keys = {};
        this.kegKey = null;
        this.kegKeyId = null;

        if (!data) return;
        // decoding
        data.publicKey = cryptoUtil.b64ToBytes(data.publicKey);
        // parsing roles
        this.admins.clear();
        data.roles.admin.forEach(username => {
            this.admins.push(getContactStore().getContactAndSave(username));
        }, this);

        // we iterate key history and decrypt keys that were encrypted for our user
        for (const keyId in data.encryptedKeys) {
            const keyObj = data.encryptedKeys[keyId];
            if (!keyObj) continue; // todo: err log
            const usersKey = keyObj.keys[this.user.username];
            if (!usersKey) continue; // todo: err log
            // currently we ignore keyObj.publicKey, but when we add key change feature for users, we'll need it
            let kegKey = cryptoUtil.b64ToBytes(usersKey);
            kegKey = publicCrypto.decrypt(
                kegKey,
                data.publicKey,
                this.user.encryptionKeys.secretKey
            );
            this.keys[keyId] = { key: kegKey, createdAt: keyObj.createdAt };
        }
        // we find max key id to assign current key to use for encryption
        const maxKeyId = Math.max(...Object.keys(data.encryptedKeys).map(id => +id)).toString();
        const kegKeyObj = this.keys[maxKeyId];
        // todo: throw fatal error to stop retries
        if (kegKeyObj) this.kegKey = kegKeyObj.key;
        this.kegKeyId = maxKeyId;
        // we extract participant list from the current key object
        this.participants = Object.keys(data.encryptedKeys[maxKeyId].keys).map(username =>
            getContactStore().getContactAndSave(username)
        ) as IObservableArray<Contact>;
    }

    serializeKegPayload() {
        this.format = this.latestFormat || this.format;
        const ephemeralKeyPair = cryptoKeys.generateEncryptionKeyPair();
        const ret = {} as ISharedDbBootKegPayload;
        ret.publicKey = cryptoUtil.bytesToB64(ephemeralKeyPair.publicKey);
        ret.roles = { admin: this.admins.map(c => c.username) };
        const k = (ret.encryptedKeys = {});
        for (const id in this.keys) {
            const keyData = this.keys[id];
            k[id] = {
                createdAt: keyData.createdAt,
                keys: {}
            };
            this.participants.forEach(c => {
                if (c.isDeleted || c.notFound) return;
                if (c.loading) {
                    throw new Error(
                        `Can not save boot keg because participant Contact (${
                            c.username
                        }) is not loaded`
                    );
                }
                const encKey = publicCrypto.encrypt(
                    keyData.key,
                    c.encryptionPublicKey,
                    ephemeralKeyPair.secretKey
                );
                k[id].keys[c.username] = cryptoUtil.bytesToB64(encKey);
            });
        }

        return ret;
    }
}

export default SharedDbBootKeg;
