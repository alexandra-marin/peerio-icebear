const { action, reaction, observable } = require('mobx');
const User = require('../user/user');
const tracker = require('../update-tracker');
const socket = require('../../network/socket');
const ReadReceipt = require('./read-receipt');
const { retryUntilSuccess } = require('../../helpers/retry');
const TaskQueue = require('../../helpers/task-queue');

/**
 *
 * @param {Chat} chat - chat creates instance and passes itself to the constructor.
 */

class ChatReceiptHandler {
    downloadedCollectionVersion = '';
    // this value means that something is scheduled to send
    pendingReceipt = null;
    _reactionsToDispose = [];

    loadQueue = new TaskQueue(1, 1000);

    constructor(chat) {
        this.chat = chat;
        // receipts cache {username: ReadReceipt}
        this.chat.receipts = observable.shallowMap();
        tracker.subscribeToKegUpdates(chat.id, 'read_receipt', this.onDigestUpdate);
        this.onDigestUpdate();
        this._reactionsToDispose.push(
            reaction(
                () => tracker.updated,
                updated => {
                    if (updated) this.onDigestUpdate();
                    if (!updated || !this.pendingReceipt) return;
                    const pos = this.pendingReceipt;
                    this.pendingReceipt = null;
                    this.sendReceipt(pos);
                }
            )
        );
        this._reactionsToDispose.push(
            reaction(
                () => this.chat.active,
                active => {
                    if (active) this.onDigestUpdate();
                }
            )
        );
    }

    onDigestUpdate = () => {
        const digest = tracker.getDigest(this.chat.id, 'read_receipt');
        if (digest.maxUpdateId < this.downloadedCollectionVersion) {
            tracker.seenThis(this.chat.id, 'read_receipt', this.downloadedCollectionVersion);
        }
        if (!this.chat.active) return;
        this.loadQueue.addTask(this.loadReceipts);
    };
    /**
     * Sends receipt for message id seen
     * @param {string} pos
     */
    sendReceipt(pos) {
        // console.debug(`sendReceipt(${pos})`);
        pos = +pos; // eslint-disable-line no-param-reassign
        // console.debug('asked to send receipt: ', pos);
        // if something is currently in progress of sending we just want to adjust max value
        if (this.pendingReceipt) {
            // console.debug('Pending receipt exists ', this.pendingReceipt);
            // we don't want to send older receipt if newer one exists already
            this.pendingReceipt = Math.max(pos, this.pendingReceipt);
            // console.debug('receipt was pending. now pending: ', this.pendingReceipt);
            return; // will be send after current receipt finishes sending
        }
        this.pendingReceipt = pos;
        // getting it from cache or from server
        retryUntilSuccess(this.loadOwnReceipt).then(r => {
            // console.debug('Loaded own receipt pos: ', r.chatPosition, ' pending: ', this.pendingReceipt);
            if (r.chatPosition >= this.pendingReceipt) {
                // ups, keg has a bigger position then we are trying to save
                // console.debug('it is higher then pending one too:', this.pendingReceipt);
                this.pendingReceipt = null;
                return;
            }
            r.chatPosition = this.pendingReceipt;
            // console.debug('Saving receipt: ', pos);
            // eslint-disable-next-line consistent-return
            return r
                .saveToServer()
                .then(() => {
                    if (r.chatPosition >= this.pendingReceipt) {
                        this.pendingReceipt = null;
                    }
                    if (this.pendingReceipt) {
                        // eslint-disable-next-line no-param-reassign
                        pos = this.pendingReceipt;
                        this.pendingReceipt = null;
                        this.sendReceipt(pos);
                    }
                })
                .catch(err => {
                    // normally, this is a connection issue or concurrency.
                    // to resolve concurrency error we reload the cached keg
                    console.error(err);
                    // eslint-disable-next-line no-param-reassign
                    pos = this.pendingReceipt;
                    this.pendingReceipt = null;
                    this._ownReceipt.load().then(() => {
                        this.sendReceipt(pos);
                    });
                });
        });
    }

    // loads own receipt keg, we needs this bcs named keg will not get created until read first time
    loadOwnReceipt = () => {
        if (this._ownReceipt) return Promise.resolve(this._ownReceipt);
        this._ownReceipt = new ReadReceipt(User.current.username, this.chat.db);
        return retryUntilSuccess(() => this._ownReceipt.load()).then(() => {
            if (!this._ownReceipt.chatPosition) this._ownReceipt.chatPosition = 0;
            return this._ownReceipt;
        });
    };

    loadReceipts = () => {
        let digest = tracker.getDigest(this.chat.id, 'read_receipt');
        if (digest.maxUpdateId && digest.maxUpdateId <= this.downloadedCollectionVersion)
            return null;
        const filter = this.downloadedCollectionVersion
            ? { minCollectionVersion: this.downloadedCollectionVersion }
            : {};
        return socket
            .send(
                '/auth/kegs/db/list-ext',
                {
                    kegDbId: this.chat.id,
                    options: {
                        type: 'read_receipt',
                        reverse: false
                    },
                    filter
                },
                false
            )
            .then(async res => {
                const { kegs } = res;
                if (!kegs || !kegs.length) return;
                for (let i = 0; i < kegs.length; i++) {
                    if (kegs[i].collectionVersion > this.downloadedCollectionVersion) {
                        this.downloadedCollectionVersion = kegs[i].collectionVersion;
                    }
                    try {
                        const r = new ReadReceipt(null, this.chat.db);
                        await r.loadFromKeg(kegs[i]);
                        if (r.owner === User.current.username) {
                            if (this._ownReceipt && this._ownReceipt.version < r.version) {
                                this._ownReceipt = r;
                            }
                        } else {
                            this.chat.receipts.set(r.owner, r);
                        }
                    } catch (err) {
                        // we don't want to break everything for one faulty receipt
                        console.error(err);
                    }
                }
                digest = tracker.getDigest(this.chat.id, 'read_receipt');
                if (digest.knownUpdateId < digest.maxUpdateId || !digest.maxUpdateId) {
                    tracker.seenThis(
                        this.chat.id,
                        'read_receipt',
                        this.downloadedCollectionVersion
                    );
                }
                this.applyReceipts();
            });
    };

    // todo: can be faster
    @action
    applyReceipts() {
        const users = this.chat.receipts.keys();

        for (let i = 0; i < this.chat.messages.length; i++) {
            const msg = this.chat.messages[i];
            msg.receipts = null;
            for (let k = 0; k < users.length; k++) {
                const username = users[k];
                const receipt = this.chat.receipts.get(username);
                if (+msg.id !== receipt.chatPosition) continue;
                // receiptError is already calculated, signature error MIGHT already have been calculated
                if (receipt.receiptError || receipt.signatureError) continue;
                msg.receipts = msg.receipts || [];
                msg.receipts.push({ username, receipt });
            }
        }
    }

    dispose() {
        this._reactionsToDispose.forEach(d => d());
        tracker.unsubscribe(this.onDigestUpdate);
        this.receipts = {};
    }
}

module.exports = ChatReceiptHandler;
