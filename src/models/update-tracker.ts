import socket from '../network/socket';
import { observable, when, reaction } from 'mobx';
import { asPromise } from '../helpers/prombservable';

/**
 * Data update tracking module. This is an internal module that allows Icebear to get and report new data as it arrives
 * and is needed by your client.
 *
 * How does update tracking work:
 *
 * 1. Update Tracker interacts with application logic via
 *      a. UpdateTracker.digest object - at any time, app logic can read data from that object,
 *          although it's not always guaranteed to be fully up to date, but it is not a problem because:
 *      b. Update events - update events are triggered in an optimized(batched) manner
 * 2. Every time connection is authenticated, Update Tracker performs update of relevant data
 *    (because we might have missed it while disconnected).
 *
 */
class UpdateTracker {
    constructor() {
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.digestUpdate, data => {
                this.processDigestEvent(
                    data.kegDbId || data.path,
                    [data.type, data.maxUpdateId, data.knownUpdateId, data.newKegsCount],
                    true
                );
            });
            socket.subscribe(
                socket.APP_EVENTS.channelDeleted,
                this.processChannelDeletedEvent.bind(this)
            );
            socket.onAuthenticated(this.loadDigest);
            socket.onDisconnect(() => {
                this.updated = false;
            });
            if (socket.authenticated) this.loadDigest();
        });
    }

    DESCRIPTOR_PATH = 'global:fileDescriptor:updated';
    /**
     * listeners to new keg db added event
     */
    dbAddedHandlers = [];
    /**
     * Listeners to changes in existing keg databases.
     */
    updateHandlers: {
        [kegDbId: string]: {
            [kegType: string]: Array<(kegDbId: string) => void>;
        };
    } = {};

    // sets to true when digest is initialized with server data at least once
    @observable loadedOnce = false;

    // for 'clientApp.updatingAfterReconnect'
    @observable updated = false;

    /**
     * Keg digest
     */
    digest: {
        [kegDbId: string]: {
            [kegType: string]: {
                maxUpdateId: string;
                knownUpdateId: string;
                newKegsCount: number;
            };
        };
    } = {};
    /**
     * Global digest
     */
    globalDigest: {
        [path: string]: {
            maxUpdateId: string;
            knownUpdateId: string;
        };
    } = {
        [this.DESCRIPTOR_PATH]: { maxUpdateId: '', knownUpdateId: '' }
    };

    get fileDescriptorDigest() {
        return this.globalDigest[this.DESCRIPTOR_PATH];
    }

    waitUntilUpdated() {
        if (this.updated) return Promise.resolve();
        return asPromise(this, 'updated', true);
    }

    onUpdated(handler, fireImmediately = false) {
        reaction(
            () => this.updated,
            updated => {
                if (updated) handler();
            },
            { fireImmediately }
        );
    }

    onceUpdated(handler) {
        when(() => this.updated, () => setTimeout(handler));
    }

    processChannelDeletedEvent(data) {
        delete this.digest[data.kegDbId];
    }

    // to return from getDigest()
    zeroDigest = { maxUpdateId: '', knownUpdateId: '', newKegsCount: 0 };

    /**
     * Wrapper around this.digest to safely retrieve data that might be not retrieved yet,
     * so we want to avoid null reference. This function will return zeroes in case of null.
     * @param id - keg db id
     * @param type - keg type
     */
    getDigest(id: string, type: string) {
        if (!this.digest[id]) return this.zeroDigest;
        const d = this.digest[id][type];
        if (!d) return this.zeroDigest;
        return d;
    }

    /**
     * Subscribes handler to an event of new keg db created for this user
     */
    subscribeToKegDbAdded(handler) {
        if (this.dbAddedHandlers.includes(handler)) {
            console.error('This handler already subscribed to subscribeToKegDbAdded');
            return;
        }
        this.dbAddedHandlers.push(handler);
    }

    /**
     * Subscribes handler to an event of keg of specific type change in keg db
     * @param kegDbId - id of the db to watch
     * @param kegType - keg type to watch
     */
    subscribeToKegUpdates(kegDbId: string, kegType: string, handler) {
        if (!this.updateHandlers[kegDbId]) {
            this.updateHandlers[kegDbId] = {};
        }

        if (!this.updateHandlers[kegDbId][kegType]) {
            this.updateHandlers[kegDbId][kegType] = [];
        }
        if (this.updateHandlers[kegDbId][kegType].includes(handler)) {
            console.error('This handler already subscribed to subscribeToKegUpdates');
            return;
        }
        this.updateHandlers[kegDbId][kegType].push(handler);
    }

    subscribeToFileDescriptorUpdates(handler) {
        this.subscribeToKegUpdates(this.DESCRIPTOR_PATH, 'global', handler);
    }

    /**
     * Unsubscribes handler from all events (subscribeToKegUpdates, subscribeToKegDbAdded)
     */
    unsubscribe(handler) {
        let ind = this.dbAddedHandlers.indexOf(handler);
        if (ind >= 0) this.dbAddedHandlers.splice(ind, 1);

        for (const db in this.updateHandlers) {
            for (const type in this.updateHandlers[db]) {
                ind = this.updateHandlers[db][type].indexOf(handler);
                if (ind >= 0) this.updateHandlers[db][type].splice(ind, 1);
            }
        }
    }

    processDigestEvent(
        kegDbId: string,
        ev: [string, string, string | 0, number],
        isFromEvent = false
    ) {
        // eslint-disable-next-line prefer-const
        let [kegType, maxUpdateId, sessionUpdateId, newKegsCount] = ev;
        // GOTCHA: when this is a digest event and not the result of getDigest
        // sessionUpdateId is actually not session specific
        // we track session known update id from within session (because session knows what it knows, right?)
        // global (user-specific) known update id only interests us at the session start
        // unpacking
        sessionUpdateId = sessionUpdateId === 0 ? maxUpdateId : sessionUpdateId;
        // kegDb yet unknown to our digest? consider it just added
        if (kegType) {
            if (!this.digest[kegDbId]) {
                this.digest[kegDbId] = {};
                this.emitKegDbAddedEvent(kegDbId);
            }

            const dbDigest = this.digest[kegDbId];
            if (!dbDigest[kegType]) {
                dbDigest[kegType] = {
                    knownUpdateId: '',
                    maxUpdateId: '',
                    newKegsCount: 0
                };
            }
            const typeDigest = dbDigest[kegType];
            // storing data in internal digest cache
            typeDigest.maxUpdateId = maxUpdateId;
            if (!isFromEvent) {
                typeDigest.knownUpdateId = sessionUpdateId;
            }
            typeDigest.newKegsCount = newKegsCount;

            if (isFromEvent || this.loadedOnce) this.emitKegTypeUpdatedEvent(kegDbId, kegType);
        } else {
            const d = this.globalDigest[kegDbId];
            if (!d) return; // unknown global digest type
            d.maxUpdateId = maxUpdateId;
            if (isFromEvent) {
                this.emitKegTypeUpdatedEvent(kegDbId, 'global');
            } else {
                d.knownUpdateId = sessionUpdateId;
            }
        }
    }

    /**
     * Emits event informing about new database getting loaded into runtime
     */
    emitKegDbAddedEvent(id) {
        if (id === 'SELF' || !this.loadedOnce) return;

        this.dbAddedHandlers.forEach(handler => {
            try {
                handler(id);
            } catch (err) {
                console.error(err);
            }
        });
    }

    /**
     * Emits one update event for a keg type in specific database.
     */
    emitKegTypeUpdatedEvent(kegDbId: string, kegType: string) {
        if (!this.loadedOnce) {
            when(() => this.loadedOnce, () => this.emitKegTypeUpdatedEvent(kegDbId, kegType));
            return;
        }
        if (!this.updateHandlers[kegDbId] || !this.updateHandlers[kegDbId][kegType]) return;
        this.updateHandlers[kegDbId][kegType].forEach(handler => {
            setTimeout(() => {
                try {
                    handler(kegDbId);
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }

    /**
     * Handles server response to digest query.
     */
    processDigestResponse(digest) {
        console.log('Processing digest response');
        const dbList = Object.keys(digest);
        try {
            for (let i = 0; i < dbList.length; i++) {
                const kegDbId = dbList[i];
                const events = digest[kegDbId];
                for (let j = 0; j < events.length; j++) {
                    this.processDigestEvent(kegDbId, events[j]);
                }
            }
            console.log('Digest loaded.');
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Fills digest with full update info from server.
     */
    loadDigest = async () => {
        console.log('Requesting full digest');
        try {
            // we are always interested in latest changes in global space and self,
            // the size of the update is small and it's safer and easier to reload it every reconnect
            let resp = await socket.send(
                '/auth/updates/digest',
                {
                    prefixes: ['global:', 'SELF']
                },
                false
            );
            this.processDigestResponse(resp);
            // we load digest that might have gotten stale due to cache on this client
            // and new digest marked as read on our other client
            resp = await socket.send(
                '/auth/updates/digest',
                {
                    prefixes: ['channel:'],
                    kegTypes: ['boot', 'chat_head']
                },
                false
            );
            this.processDigestResponse(resp);

            resp = await socket.send('/auth/updates/digest', { unread: true }, false);
            this.processDigestResponse(resp);

            if (!this.loadedOnce) {
                this.markZeroCounterTypesAsRead();
            }
            this.loadedOnce = true;
            this.updated = true;
        } catch (err) {
            if (err && err.name === 'TimeoutError') {
                this.loadDigest();
            }
        }
    };

    // call this to make sure db digest is loaded disregarding its unread status
    async loadDigestFor(kegDbId) {
        const resp = await socket.send('/auth/updates/digest', { prefixes: [kegDbId] }, false);
        this.processDigestResponse(resp);
    }

    // In the beginning of session, any unread digest items with newKegsCount = 0
    // or with newKegsCount>0 but for keg types which counters are not useful to us - are leftovers that we can
    // remove to minimize digest size
    markZeroCounterTypesAsRead() {
        for (const dbId in this.digest) {
            const db = this.digest[dbId];
            for (const type in db) {
                const item = db[type];
                if (type === 'message') {
                    if (item.newKegsCount > 0) continue;
                }
                if (item.knownUpdateId < item.maxUpdateId) {
                    this.seenThis(dbId, type, item.maxUpdateId);
                }
            }
        }
    }

    seenThisQueue = {};
    /**
     * Stores max update id that user has seen to server.
     * @param id - keg db id
     * @param type - keg type
     * @param updateId - max known update id
     */
    seenThis(id: string, type: string, updateId: string, throttle = true) {
        if (!updateId) return;

        if (throttle) {
            if (this.seenThisQueue[id]) {
                if (this.seenThisQueue[id][type]) {
                    // just updating parameter, will get used when scheduled
                    this.seenThisQueue[id][type] = updateId;
                    return;
                }
            } else this.seenThisQueue[id] = {};
            this.seenThisQueue[id][type] = updateId;
            // scheduling a run
            setTimeout(() => this.seenThis(id, type, this.seenThisQueue[id][type], false), 4000);
            return;
        }

        if (this.seenThisQueue[id] && this.seenThisQueue[id][type]) {
            this.seenThisQueue[id][type] = '';
        }

        let digest = this.getDigest(id, type);
        if (digest === this.zeroDigest) {
            // if we don't have digest loaded, we assume that's because there was no unread items in it
            // so we create digest record locally without requesting it from server
            if (!this.digest[id]) this.digest[id] = {};
            digest = {
                maxUpdateId: updateId,
                knownUpdateId: updateId,
                newKegsCount: 0
            };
            this.digest[id][type] = digest;
        } else if (digest.knownUpdateId >= updateId) return;
        // console.debug('SEEN THIS', id, type, updateId);
        // consumers should not care if this call fails, it makes things simpler.
        // to cover failure cases, consumers should activate 'mark as read' logic after every reconnect
        if (!socket.authenticated) return;
        socket
            .send(
                '/auth/updates/last-known-version',
                {
                    path: type ? `${id}:${type}` : id,
                    lastKnownVersion: updateId
                },
                false
            )
            .then(() => {
                if (digest.knownUpdateId < updateId) digest.knownUpdateId = updateId;
            })
            .catch(this.logSeenThisError);
    }

    logSeenThisError(err) {
        console.error(err);
    }
}

export default new UpdateTracker();
