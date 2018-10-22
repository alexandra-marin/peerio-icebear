import SharedDbBootKeg from './shared-db-boot-keg';
import socket from '../../network/socket';
import User from '../user/user';
import contactStore from '../contacts/contact-store';
import { uniq } from 'lodash';
import { retryUntilSuccess } from '../../helpers/retry';
import Contact from '../contacts/contact';
import { observable, computed, IObservableArray } from 'mobx';
import { IKegDb } from '../../defs/interfaces';

// @ts-ignore to support desktop declarations emit until monorepo
import Bluebird from 'bluebird';

/**
 * Class for shared keg databases.
 * Model is not really created until boot keg is updated for the first time.
 * Multiple people might try to create boot keg for the same chat at the same time.
 * We have a special logic to resolve this kind of situations.
 *
 * SharedKegDb is similar to KegDb in a sense that it has same `id`, `boot` and `key`
 * properties, but the logic is too different to extract a base class. Although when saving and loading Kegs,
 * you can use both databases, the properties mentioned is all Kegs can care about.
 *
 * Chat loading logic // todo: update this with channels logic modifications
 * ```
 * retryUntilSuccess(
 * 1. Do we have ID for the chat?
 * - 1.1 NO:
 *      - create-chat
 *      - if resolved: now we have chat meta data, GOTO (2.)
 *      - if rejected: retry is triggered
 * - 1.2 YES:
 *      - get metadata
 *      - if resolved: now we have chat meta data, GOTO (2.)
 *      - if rejected: retry is triggered
 * 2. Parse chat metadata
 * 3. Does boot keg exist? (load it and check if keg version > 1)
 * - 3.1 YES:
 *      - load boot keg
 *      - resolved: is it valid ?
 *          - YES: FINISH. Promise.resolve(true)
 *          - NO: FINISH. Promise.resolve(false) for retry to not trigger
 *      - rejected: retry is triggered
 * - 3.2 NO:
 *      - create boot keg.
 *          - resolved: FINISH. Promise.resolve(true)
 *          - rejected: retry is triggered
 * - 3.3 load failed: retry is triggered
 * , 'Unique retry id')
 * ```
 */
class SharedKegDb implements IKegDb {
    /**
     * @param id - specific id for shared databases
     * @param participants - participants list, EXCLUDING own username
     * @param isChannel - does this db belong to a DM or Channel
     */
    constructor(
        id?: string,
        participants: Contact[] = [],
        isChannel = false,
        onBootKegLoadedFromKeg?: () => {}
    ) {
        this.id = id;
        this.onBootKegLoadedFromKeg = onBootKegLoadedFromKeg;
        const usernames = uniq(participants.map(p => p.username));
        if (usernames.length !== participants.length) {
            console.warn('ChatKegDb constructor received participant list containing duplicates.');
        }
        const ind = usernames.indexOf(User.current.username);
        if (ind >= 0) {
            usernames.splice(ind, 1);
            console.warn(
                'ChatKegDb constructor received participant list containing current user.'
            );
        }
        this.participantsToCreateWith = usernames.map(p => contactStore.getContactAndSave(p));

        this.isChannel = isChannel;
    }

    onBootKegLoadedFromKeg: () => {};
    rawMeta: {}; // this a raw server-returned meta object to cache as-is, maybe type it later
    _metaParticipants: Contact[];
    /**
     * Returns the name of keg type for URLs.
     * APIs will get called as `/auth/kegs/db/create-${this.urlName}`.
     */
    get urlName(): string {
        throw new Error('urlName not implemented');
    }

    /**
     * System-wide unique database id generated by server
     */
    id: string;
    /**
     * Database key to use for keg encryption.
     */
    get key() {
        return this.boot ? this.boot.kegKey : null;
    }

    /**
     * Current key id for the database
     */
    get keyId() {
        return this.boot ? this.boot.kegKeyId : null;
    }

    @observable boot: SharedDbBootKeg;

    /**
     * Just a mirror of this.boot.participants
     */
    @computed
    get participants(): IObservableArray<Contact> {
        return (this.boot && this.boot.participants) || observable.array([], { deep: false });
    }

    /**
     * Just a mirror of this.boot.admins
     */
    @computed
    get admins(): Contact[] {
        return (this.boot && this.boot.admins) || [];
    }

    /**
     * All participants except current user.
     * This will be used to create chat, if passed.
     * For DMs create operation will return existing chat.
     */
    participantsToCreateWith: Contact[];

    /**
     * if true - something is wrong with boot keg, most likely it was maliciously created and can't be used
     */
    dbIsBroken = false;

    /**
     * Is this a channel or DM db.
     * TODO: this property needs to be renamed as now it means 'is channel or volume'
     *       what we actually want to know here is wether we need to support adding participants
     *       and what api to use when creating kegdb
     */
    isChannel: boolean;

    /**
     * Performs initial load of the keg database data based on id or participants list.
     * Will create kegDb and boot keg if needed.
     */
    loadMeta(cachedMeta?, cachedBootKeg?): Promise<{ justCreated: boolean; rawMeta: {} }> {
        return retryUntilSuccess(() => {
            if (this.id) {
                return this._loadExistingMeta(cachedMeta, cachedBootKeg);
            }
            return this._createMeta();
        });
    }

    async _loadExistingMeta(cachedMeta?, cachedBootKeg?) {
        let meta = cachedMeta;
        if (!meta) {
            meta = await socket.send('/auth/kegs/db/meta', { kegDbId: this.id }, false);
        }
        this._parseMeta(meta);
        return this._resolveBootKeg(cachedBootKeg);
    }

    _createMeta() {
        if (this.isChannel) {
            return socket
                .send(`/auth/kegs/db/create-${this.urlName}`)
                .then(this._parseMeta)
                .then(this._resolveBootKeg);
        }
        const arg = {
            participants: this.participantsToCreateWith.map(p => p.username)
        };
        arg.participants.push(User.current.username);
        // server will return existing chat if it does already exist
        // the logic below takes care of rare collision cases, like when users create chat or boot keg at the same time
        return socket
            .send(`/auth/kegs/db/create-${this.urlName}`, arg)
            .then(this._parseMeta)
            .then(this._resolveBootKeg);
    }

    // fills current object properties from raw keg metadata
    _parseMeta = meta => {
        this.rawMeta = meta;
        this.id = meta.id;
        if (!this.isChannel && meta.permissions && meta.permissions.users) {
            this._metaParticipants = Object.keys(meta.permissions.users).map(username =>
                contactStore.getContactAndSave(username)
            );
        }
    };

    // figures out if we need to load/create boot keg and does it
    _resolveBootKeg = cachedBootKeg => {
        return this.loadBootKeg(cachedBootKeg)
            .then(boot => {
                if (boot.version > 1) {
                    // disabled for now, not sure we will ever need to migrate DM boot kegs
                    // (rooms are all in new format from the start)
                    // Migrating boot keg
                    if (!boot.format) {
                        boot.participants = observable.array(this._metaParticipants, {
                            deep: false
                        });
                        //     // prevent spamming server on bootkeg migration
                        //     return Promise.delay(Math.round(Math.random() * 3000 + 2000))
                        //         .then(() => Contact.ensureAllLoaded(boot.participants))
                        //         .then(() => (boot.format ? null : boot.saveToServer()))
                        //         .catch(err => {
                        //             console.error('Failed to migrate boot keg.', this.id, err);
                        //         })
                        //         .return([boot, false]);
                    }
                    return Promise.resolve([boot, false]);
                }
                return this.createBootKeg();
            })
            .spread((boot, justCreated) => {
                this.boot = boot as SharedDbBootKeg;
                if (!this.key && !justCreated) this.dbIsBroken = true;
                return { justCreated, rawMeta: this.rawMeta } as {
                    justCreated: boolean;
                    rawMeta: {};
                };
            })
            .tapCatch(err => console.error(err));
    };

    /**
     * Create boot keg for this database
     */
    createBootKeg(): Promise<[SharedDbBootKeg, boolean]> {
        console.log(
            `Creating ${this.urlName} boot keg for ${this.id}, isChannel:${this.isChannel}`
        );
        const participants = this.participantsToCreateWith.slice();
        participants.push(contactStore.currentUser);
        return Contact.ensureAllLoaded(participants).then(() => {
            // keg key for this db
            const boot = new SharedDbBootKeg(this, User.current);
            boot.onLoadedFromKeg = this.onBootKegLoadedFromKeg;
            boot.addKey();
            participants.forEach(p => {
                boot.addParticipant(p);
            });
            if (this.isChannel) {
                boot.assignRole(contactStore.currentUser, 'admin');
            }

            // saving bootkeg
            return boot.saveToServer().return([boot, true]);
        }) as Promise<[SharedDbBootKeg, boolean]>;
    }

    /**
     * Retrieves boot keg for the db and initializes this KegDb instance with required data.
     */
    async loadBootKeg(cachedBootKeg): Promise<SharedDbBootKeg> {
        // console.log(`Loading chat boot keg for ${this.id}`);
        const boot = new SharedDbBootKeg(this, User.current);
        if (cachedBootKeg && (await boot.loadFromKeg(cachedBootKeg))) {
            // important to not set before .loadFromKeg call, but to set before return
            boot.onLoadedFromKeg = this.onBootKegLoadedFromKeg;
            return boot;
        }
        boot.onLoadedFromKeg = this.onBootKegLoadedFromKeg;
        return boot._enqueueLoad().return(boot);
    }
}

export default SharedKegDb;
