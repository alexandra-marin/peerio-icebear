
const socket = require('../network/socket');
const { observable } = require('mobx');

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
 *    (cuz we might have missed it while disconnected). We don't do full update info reload because it has
 *    a potential to grow really big.
 *      a. SELF database info is always reloaded
 *      b. anything that is {unread: true} is reloaded
 *      c. anything that contains {kegType: 'important keg type'} is reloaded
 *      d. anything that is currently active in the UI (chat) is reloaded
 *
 * @namespace UpdateTracker
 * @protected
 */
class UpdateTracker {
    /**
     * listeners to new keg db added event
     * @member {Array<function>}
     * @private
     */
    dbAddedHandlers = [];
    /**
     * Listeners to changes in existing keg databases.
     * @member {{kegDbId: {kegType: function}}}
     * @private
     */
    updateHandlers = {};

    // sets to true when digest is initialized with server data at least once
    @observable loadedOnce = false;

    // for 'clientApp.updatingAfterReconnect'
    @observable updatedAfterReconnect = false;

    /**
     * Current digest
     * @member {kegDbId:{ kegType: { maxUpdateId: string, knownUpdateId: string, newKegsCount: number }}
     * @protected
     */
    digest = {};

    // this flag controls whether updates to digest will immediately fire an event or
    // will accumulate to allow effective/minimal events generation after large amounts for digest data
    // has been processed
    accumulateEvents = true;
    // accumulated events go here
    eventCache = { add: [], update: {} };

    constructor() {
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.kegsUpdate, this.processDigestEvent.bind(this));
            socket.subscribe(socket.APP_EVENTS.channelDeleted, this.processChannelDeletedEvent.bind(this));
            socket.onAuthenticated(this.loadDigest);
            // when disconnected, we know that reconnect will trigger digest reload
            // and we want to accumulate events during that time
            socket.onDisconnect(() => {
                this.updatedAfterReconnect = false;
                this.accumulateEvents = true;
            });
            if (socket.authenticated) this.loadDigest();
        });
    }

    processChannelDeletedEvent(data) {
        delete this.digest[data.kegDbId];
    }

    // to return from getDigest()
    zeroDigest = { maxUpdateId: '', knownUpdateId: '', newKegsCount: 0 };

    /**
     * Wrapper around this.digest to safely retrieve data that might be not retrieved yet,
     * so we want to avoid null reference. This function will return zeroes in case of null.
     * @param {string} id - keg db id
     * @param {string} type - keg type
     * @protected
     */
    getDigest(id, type) {
        if (!this.digest[id]) return this.zeroDigest;
        const d = this.digest[id][type];
        if (!d) return this.zeroDigest;
        return d;
    }

    /**
     * Subscribes handler to an event of new keg db created for this user
     * @param {function} handler
     * @protected
     */
    onKegDbAdded(handler) {
        if (this.dbAddedHandlers.includes(handler)) {
            console.error('This handler already subscribed to onKegDbAdded');
            return;
        }
        this.dbAddedHandlers.push(handler);
    }

    /**
     * Subscribes handler to an event of keg of specific type change in keg db
     * @param {string} kegDbId - id of the db to watch
     * @param {string} kegType - keg type to watch
     * @param {function} handler
     * @protected
     */
    onKegTypeUpdated(kegDbId, kegType, handler) {
        if (!this.updateHandlers[kegDbId]) {
            this.updateHandlers[kegDbId] = {};
        }

        if (!this.updateHandlers[kegDbId][kegType]) {
            this.updateHandlers[kegDbId][kegType] = [];
        }
        if (this.updateHandlers[kegDbId][kegType].includes(handler)) {
            console.error('This handler already subscribed to onKegTypeUpdated');
            return;
        }
        this.updateHandlers[kegDbId][kegType].push(handler);
    }

    /**
     * Unsubscribes handler from all events (onKegTypeUpdated, onKegDbAdded)
     * @param {function} handler
     * @protected
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

    //  {"kegDbId":"SELF","type":"profile","maxUpdateId":3, knownUpdateId: 0, newKegsCount: 1},
    processDigestEvent(ev) {
        ev.maxUpdateId = ev.maxUpdateId || '';
        ev.knownUpdateId = ev.knownUpdateId || '';
        // === HACK:
        // this is a temporary hack to make sure boot kegs don't produce unread keg databases
        // It's too much hassle to create handlers for this in the kegdb logic
        // when we introduce key change which can change boot keg - this should go away
        // NOTE: Commented out because of channels, chat migrations and changing the way digest works with unread data.
        //       Probably we won't need this anymore.
        // if (ev.type === 'boot' && ev.maxUpdateId !== ev.knownUpdateId) {
        //     this.seenThis(ev.kegDbId, 'boot', ev.maxUpdateId);
        // }

        // The same for tofu keg, it's never supposed to be updated atm so we always mark it as read
        // Tofu kegs are named, names are unique per contact.
        if (ev.type === 'tofu' && ev.maxUpdateId !== ev.knownUpdateId) {
            this.seenThis(ev.kegDbId, 'tofu', ev.maxUpdateId);
        }
        // The same for my_chats keg, we don't rely on its collection version currently
        if (ev.type === 'my_chats' && ev.maxUpdateId !== ev.knownUpdateId) {
            this.seenThis(ev.kegDbId, 'my_chats', ev.maxUpdateId);
        }
        // === /HACK

        // here we want to do 2 things
        // 1. update internal data tracker
        // 2. fire or accumulate events

        let shouldEmitUpdateEvent = false;

        // kegDb yet unknown to our digest? consider it just added
        if (!this.digest[ev.kegDbId]) {
            shouldEmitUpdateEvent = true;
            this.digest[ev.kegDbId] = this.digest[ev.kegDbId] || {};
            if (this.accumulateEvents) {
                if (!this.eventCache.add.includes(ev.kegDbId)) {
                    this.eventCache.add.push(ev.kegDbId);
                }
            } else {
                this.emitKegDbAddedEvent(ev.kegDbId);
            }
        }
        const dbDigest = this.digest[ev.kegDbId];
        if (!dbDigest[ev.type]) {
            shouldEmitUpdateEvent = true;
            dbDigest[ev.type] = {};
        }
        const typeDigest = dbDigest[ev.type];
        // if this db and keg type was already known to us
        // we need to check if this event actually brings something new to us,
        // or maybe it was out of order and we don't care for its data
        if (!shouldEmitUpdateEvent
            && typeDigest.maxUpdateId >= ev.maxUpdateId
            && typeDigest.knownUpdateId >= ev.knownUpdateId
            && typeDigest.newKegsCount === ev.newKegsCount) {
            return; // known data / not interested
        }
        // storing data in internal digest cache
        typeDigest.maxUpdateId = ev.maxUpdateId;
        typeDigest.knownUpdateId = ev.knownUpdateId;
        typeDigest.newKegsCount = ev.newKegsCount;
        // creating event
        if (this.accumulateEvents) {
            const rec = this.eventCache.update[ev.kegDbId] = this.eventCache.update[ev.kegDbId] || [];
            if (!rec.includes(ev.type)) {
                rec.push(ev.type);
            }
        } else {
            this.emitKegTypeUpdatedEvent(ev.kegDbId, ev.type);
        }
    }

    /**
     * Emits event informing about new database getting loaded into runtime
     * @private
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
     * @param {string} id
     * @param {string} type
     * @private
     */
    emitKegTypeUpdatedEvent(id, type) {
        if (!this.updateHandlers[id] || !this.updateHandlers[id][type]) return;
        this.updateHandlers[id][type].forEach(handler => {
            try {
                handler(id);
            } catch (err) {
                console.error(err);
            }
        });
    }

    /**
     * Emits events in the end of digest reloading cycle.
     * @private
     */
    flushAccumulatedEvents = () => {
        this.eventCache.add.forEach(id => {
            this.emitKegDbAddedEvent(id);
        });
        for (const id in this.eventCache.update) {
            this.eventCache.update[id].forEach(type => {
                this.emitKegTypeUpdatedEvent(id, type);
            });
        }
        this.eventCache = { add: [], update: {} };
        this.accumulateEvents = false;
    };

    /**
     * Handles server response to digest query.
     * @private
     */
    processDigestResponse = digest => {
        console.debug('Processing digest response');
        try {
            for (let i = 0; i < digest.length; i++) {
                // console.debug(JSON.stringify(digest[i], null, 1));
                this.processDigestEvent(digest[i]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Fills digest with full update info from server.
     * @private
     */
    loadDigest = () => {
        console.log('Requesting full digest');
        socket.send('/auth/kegs/updates/digest')
            .then(this.processDigestResponse)
            .then(this.flushAccumulatedEvents)
            .then(() => {
                this.loadedOnce = true;
                this.updatedAfterReconnect = true;
            })
            .catch(err => {
                if (err && err.name === 'TimeoutError') {
                    this.loadDigest();
                }
            });
    }

    /**
     * Stores max update id that user has seen to server.
     * @param {string} id - keg db id
     * @param {string} type - keg type
     * @param {string} updateId - max known update id
     * @protected
     */
    seenThis(id, type, updateId) {
        if (!updateId) return;
        const digest = this.getDigest(id, type);
        if (digest.knownUpdateId >= updateId) return;
        // consumers should not care if this call fails, it makes things simpler.
        // to cover failure cases, consumers should activate 'mark as read' logic after every reconnect
        socket.send('/auth/updates/last-known-version', {
            kegDbId: id,
            type,
            lastKnownVersion: updateId
        }).catch(this.logSeenThisError);
    }

    logSeenThisError(err) {
        console.error(err);
    }
}

module.exports = new UpdateTracker();
