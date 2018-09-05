import { serverErrorCodes } from '../../errors';
import tracker from '../update-tracker';
import { retryUntilSuccess } from '../../helpers/retry';
import TaskQueue from '../../helpers/task-queue';
import Keg from './keg';
import warnings from '../warnings';
import { IKegDb } from '~/defs/interfaces';

/**
 * This class allows named kegs to share sync/save logic.
 * This is for named kegs only! Named kegs assume there's just one instance of it.
 */
class SyncedKeg<TPayload, TProps> extends Keg<TPayload, TProps> {
    /**
     * @param kegName - kegName === kegType currently
     * @param db - this keg owner database
     * @param plaintext - encrypted or not
     * @param forceSign - force signature of plaintext kegs or not
     * @param noSync - in rare cases we want to use some keg that extends synced keg out of normal flow,
     *                 like one-time decryption, for that we need to disable synced keg sync automation.
     */
    constructor(
        kegName: string,
        db: IKegDb,
        plaintext = false,
        forceSign = false,
        allowEmpty = true,
        storeSignerData = false,
        noSync = false
    ) {
        super(kegName, kegName, db, plaintext, forceSign, allowEmpty, storeSignerData);

        if (!noSync) {
            // this will load initial data
            tracker.onceUpdated(() => {
                // this is hacky, but there's no better way unless we refactor login seriously
                // the problem is with failed login leaving synced keg instances behind without cleaning up subscription
                if (this.db.id === 'SELF' && (!this.db.boot || !this.db.boot.keys)) return;
                // this will make sure we'll update every time server sends a new digest
                // it will also happen after reconnect, because digest is always refreshed on reconnect
                tracker.subscribeToKegUpdates(db.id, kegName, this._enqueueLoad);
                this._enqueueLoad();
            });
        }
    }

    _syncQueue = new TaskQueue(1, 0);

    _enqueueLoad = () => {
        return this._syncQueue.addTask(this._loadKeg);
    };

    _loadKeg = () =>
        retryUntilSuccess(() => {
            // do we even need to update?
            const digest = tracker.getDigest(this.db.id, this.type);
            if (this.collectionVersion !== null && this.collectionVersion >= digest.maxUpdateId) {
                this.loaded = true;
                return Promise.resolve();
            }
            return this.reload();
        });

    /**
     * Forces updating keg data from server
     */
    reload = () => {
        return this.load().then(() => {
            tracker.seenThis(this.db.id, this.type, this.collectionVersion);
            this.onUpdated();
            // this will make sure that we get any updates we possibly got notified about
            // while finishing current operation
            this._enqueueLoad();
        });
    };

    /**
     * Enqueues Save task.
     *
     * @param dataChangeFn - function that will be called right before keg save,
     * it has to mutate keg's state. Return false to cancel save.
     * @param dataRestoreFn - function that will be called to restore keg state to the point before
     * dataChangeFn mutated it. Default implementation will rely on keg serialization functions. dataRestoreFn will only
     * get called if version of the keg didn't change after save failed. This will make sure we won't overwrite
     * freshly received data from server.
     * @param errorLocaleKey - optional error to show in snackbar
     */
    save(dataChangeFn: () => boolean, dataRestoreFn?: () => void, errorLocaleKey?: string) {
        return new Promise((resolve, reject) => {
            this._syncQueue.addTask(
                () => {
                    const ver = this.version;

                    if (!dataRestoreFn) {
                        // implementing default restore logic
                        const payload = this.serializeKegPayload();
                        const props = this.serializeProps();
                        // eslint-disable-next-line no-param-reassign
                        dataRestoreFn = () => {
                            this.deserializeProps(props);
                            this.deserializeKegPayload(payload);
                        };
                    }

                    if (dataChangeFn() === false) {
                        // dataChangeFn decided not to save changes
                        return null;
                    }

                    return this.saveToServer()
                        .then(() => {
                            tracker.seenThis(this.db.id, this.type, this.collectionVersion);
                            this.onSaved();
                        })
                        .catch(err => {
                            this.onSaveError(errorLocaleKey);
                            // we don't restore unless there was no changes after ours
                            if (ver === this.version) {
                                dataRestoreFn();
                            }
                            if (err && err.code === serverErrorCodes.malformedRequest) {
                                return this.reload().then(() => Promise.reject(err));
                            }
                            return Promise.reject(err);
                        });
                },
                this,
                null,
                resolve,
                reject
            );
        });
    }

    /**
     * Override to perform actions after keg data has been updated from server.
     */
    onUpdated() {
        // abstract function
    }

    /**
     * Override to perform actions after keg data has been saved.
     */
    onSaved() {
        // abstract function
    }

    /**
     * Override if required. Default implementation generates medium warning if locale key is provided.
     */
    onSaveError(localeKey?: string) {
        if (!localeKey) return;
        warnings.add(localeKey);
    }
}

export default SyncedKeg;
