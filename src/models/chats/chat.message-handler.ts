//
// Module takes care of listening to chat updates and loading updated data
//
import { serverErrorCodes } from '../../errors';
import tracker from '../update-tracker';
import socket from '../../network/socket';
import config from '../../config';
import { retryUntilSuccess } from '../../helpers/retry';
import { reaction, action } from 'mobx';
import clientApp from '../client-app';
import { getChatStore } from '../../helpers/di-chat-store';

/**
 *
 * @param {Chat} chat - chat creates instance and passes itself to the constructor.
 */
class ChatMessageHandler {
    constructor(chat) {
        this.chat = chat;
        // asynchronously. to avoid changing unreadCount in reaction to unreadCount change
        tracker.subscribeToKegUpdates(chat.id, 'message', () =>
            setTimeout(this.onMessageDigestUpdate)
        );
        this.onMessageDigestUpdate();
        this._reactionsToDispose.push(
            reaction(
                () =>
                    this.chat.active &&
                    clientApp.isInChatsView &&
                    clientApp.isReadingNewestMessages,
                active => {
                    if (active) {
                        this.onMessageDigestUpdate();
                        this.markAllAsSeen();
                        this.removeMaker();
                    } else {
                        this.cancelTimers();
                    }
                }
            )
        );
        this._reactionsToDispose.push(
            reaction(
                () => tracker.updated,
                updated => {
                    if (updated) {
                        this.onMessageDigestUpdate();
                    } else {
                        this.chat.updatedAfterReconnect = false;
                    }
                }
            )
        );
        this._reactionsToDispose.push(
            reaction(
                () =>
                    tracker.updated &&
                    this.chat.active &&
                    clientApp.isFocused &&
                    clientApp.isInChatsView &&
                    clientApp.isReadingNewestMessages,
                userIsReading => {
                    if (userIsReading) {
                        this.markAllAsSeen();
                        this.removeMaker();
                    } else if (!this.chat.newMessagesMarkerPos && this.chat.messages.length) {
                        this.cancelTimers();
                        const lastId = this.chat.messages[this.chat.messages.length - 1].id;
                        this.chat.newMessagesMarkerPos = lastId;
                    }
                }
            )
        );
    }

    maxUpdateId = '';
    downloadedUpdateId = '';
    _loadingUpdates = false; // todo: make this observable in Chat

    _reactionsToDispose = [];

    cancelTimers() {
        if (this._markAsSeenTimer !== null) {
            clearTimeout(this._markAsSeenTimer);
        }
        if (this._removeMarkerTimer !== null) {
            clearTimeout(this._removeMarkerTimer);
        }
    }

    removeMaker() {
        if (!clientApp.isFocused || !clientApp.isInChatsView || !this.chat.active) return;
        if (this._removeMarkerTimer) clearTimeout(this._removeMarkerTimer);
        this._removeMarkerTimer = setTimeout(() => {
            this._removeMarkerTimer = null;
            if (!clientApp.isFocused || !clientApp.isInChatsView || !this.chat.active) return;
            this.chat.newMessagesMarkerPos = null;
        }, 15000);
    }

    onMessageDigestUpdate = () => {
        const msgDigest = tracker.getDigest(this.chat.id, 'message');
        this.chat.unreadCount = msgDigest.newKegsCount;
        this.maxUpdateId = msgDigest.maxUpdateId;
        this.loadUpdates();
    };

    loadUpdates() {
        if (
            !(this.chat.mostRecentMessageLoaded || this.chat.initialPageLoaded) ||
            !socket.authenticated
        )
            return;
        if (this.chat.canGoDown || this.downloadedUpdateId >= this.maxUpdateId) {
            this.chat.updatedAfterReconnect = true;
            return;
        }

        if (this._loadingUpdates) {
            return;
        }
        this._loadingUpdates = true;

        // console.log('Getting updates for chat', this.chat.id);
        const filter = this.downloadedUpdateId
            ? { minCollectionVersion: this.downloadedUpdateId }
            : {};
        socket
            .send(
                '/auth/kegs/db/list-ext',
                {
                    kegDbId: this.chat.id,
                    options: {
                        count: config.chat.maxLoadedMessages,
                        type: 'message',
                        reverse: false
                    },
                    filter
                },
                false
            )
            .tapCatch(() => {
                this._loadingUpdates = false;
            })
            .then(
                action(async resp => {
                    this._loadingUpdates = false;
                    // there's way more updates then we are allowed to load
                    // so we jump to most recent messages
                    if (resp.hasMore) {
                        this.chat.reset();
                        return;
                    }
                    this.setDownloadedUpdateId(resp.kegs);
                    this.markAllAsSeen();
                    console.log(`Got ${resp.kegs.length} updates for chat`, this.chat.id);
                    await this.chat.addMessages(resp.kegs);
                    this.onMessageDigestUpdate();
                    this.chat.updatedAfterReconnect = true;
                })
            )
            .catch(err => {
                if (err && err.code === serverErrorCodes.accessForbidden) {
                    getChatStore().unloadChat(this.chat);
                } else {
                    this.onMessageDigestUpdate();
                }
            });
    }

    markAllAsSeen() {
        if (
            !clientApp.isFocused ||
            !clientApp.isInChatsView ||
            !this.chat.active ||
            !clientApp.isReadingNewestMessages
        )
            return;
        this._markAsSeenTimer = setTimeout(() => {
            this._markAsSeenTimer = null;
            if (!clientApp.isFocused || !clientApp.isInChatsView || !this.chat.active) return;
            tracker.seenThis(this.chat.id, 'message', this.downloadedUpdateId, false);
        }, this._getTimeoutValue(this.chat.unreadCount));
    }

    _getTimeoutValue(unreadCount) {
        if (unreadCount <= 5) return 0;
        if (unreadCount < 20) return 1000;
        return 1500;
    }

    setDownloadedUpdateId(kegs) {
        for (let i = 0; i < kegs.length; i++) {
            if (kegs[i].collectionVersion > this.downloadedUpdateId) {
                this.downloadedUpdateId = kegs[i].collectionVersion;
            }
        }
    }

    loadMostRecentMessage() {
        // This feature is not being used anymore,
        // but it is not easy just to get rid of the flag,
        // because it's being listened to by chat update code
        // and it's being set when it is ok to actually load any updates (metaLoaded).
        // In other words - it's in a chain of things that are supposed to execute in order.
        // So maybe let's keep it this way for now to avoid refactoring that.
        // Also maybe this feature will be requested again by product team.
        setTimeout(() => {
            this.chat.mostRecentMessageLoaded = true;
        });
        // DO NOT delete commented code, unless you are getting rid of the flag and the whole feature
        /*
        retryUntilSuccess(() => socket.send('/auth/kegs/db/list-ext', {
            kegDbId: this.chat.id,
            options: {
                type: 'message',
                reverse: true,
                offset: 0,
                count: 1
            }
        }, false))
            .then(action(resp => {
                this.setDownloadedUpdateId(resp.kegs);
                this.chat.mostRecentMessageLoaded = true;
                return this.chat.addMessages(resp.kegs);
            }));
        */
    }

    getInitialPage() {
        if (this.chat.initialPageLoaded || this.chat.loadingInitialPage) {
            return Promise.resolve();
        }
        this.chat.loadingInitialPage = true;
        console.log('loading initial page for this.chat', this.chat.id);
        return retryUntilSuccess(
            () =>
                socket.send(
                    '/auth/kegs/db/list-ext',
                    {
                        kegDbId: this.chat.id,
                        options: {
                            type: 'message',
                            reverse: true,
                            offset: 0,
                            count: config.chat.initialPageSize
                        }
                    },
                    false
                ),
            undefined,
            5
        )
            .then(
                action(resp => {
                    this.chat.canGoUp = resp.hasMore;
                    this.chat._cancelTopPageLoad = false;
                    this.chat._cancelBottomPageLoad = false;
                    this.setDownloadedUpdateId(resp.kegs);
                    if (!this.chat.canGoDown) this.markAllAsSeen();
                    console.log(`got initial ${resp.kegs.length} for this.chat`, this.chat.id);
                    return this.chat.addMessages(resp.kegs).finally(() => {
                        this.chat.loadingInitialPage = false;
                        this.chat.initialPageLoaded = true;
                    });
                })
            )
            .catch(err => {
                if (err && err.code === serverErrorCodes.accessForbidden) {
                    getChatStore().unloadChat(this.chat);
                } else {
                    throw err;
                }
            });
    }
    // startingKegId means that full page of empty messages has been detected and paging re-triggered
    getPage(pagingUp = true, startingKegId = null) {
        if (
            !this.chat.initialPageLoaded ||
            (pagingUp && this.chat.loadingTopPage) ||
            (!pagingUp && this.chat.loadingBottomPage)
        ) {
            return;
        }
        console.debug('Loading page', pagingUp ? 'UP' : 'DOWN');
        if (pagingUp) {
            this.chat.loadingTopPage = true;
            if (this.chat.loadingBottomPage) {
                this.chat._cancelBottomPageLoad = true;
                console.debug('Bottom page load cancelled');
            }
        } else {
            this.chat.loadingBottomPage = true;
            if (this.chat.loadingTopPage) {
                this.chat._cancelTopPageLoad = true;
                console.debug('Top page load cancelled');
            }
        }
        // todo: cancel retries if navigated away from chat?
        retryUntilSuccess(
            () =>
                socket.send(
                    '/auth/kegs/db/list-ext',
                    {
                        kegDbId: this.chat.id,
                        options: {
                            type: 'message',
                            reverse: pagingUp,
                            fromKegId:
                                startingKegId ||
                                this.chat.messages[pagingUp ? 0 : this.chat.messages.length - 1].id,
                            count: config.chat.pageSize
                        }
                    },
                    false
                ),
            undefined,
            5
        )
            .catch(err => {
                if (err && err.code === serverErrorCodes.accessForbidden) {
                    getChatStore().unloadChat(this.chat);
                } else {
                    throw err;
                }
            })
            .then(
                action(resp => {
                    console.debug(
                        'Received page',
                        pagingUp ? 'UP' : 'DOWN',
                        (pagingUp && this.chat._cancelTopPageLoad) ||
                        (!pagingUp && this.chat._cancelBottomPageLoad)
                            ? 'and discarded'
                            : ''
                    );
                    if (pagingUp) {
                        if (this.chat._cancelTopPageLoad) return;
                        this.chat.canGoUp = resp.hasMore;
                    } else {
                        if (this.chat._cancelBottomPageLoad) return;
                        this.chat.canGoDown = resp.hasMore;
                    }
                    if (!pagingUp) {
                        this.setDownloadedUpdateId(resp.kegs);
                        this.markAllAsSeen();
                    }
                    // eslint-disable-next-line consistent-return
                    return this.chat.addMessages(resp.kegs, pagingUp);
                    // in case we paged to the most recent or new to us messages
                })
            )
            .finally(() => {
                if (pagingUp) {
                    this.chat.loadingTopPage = false;
                    this.chat._cancelTopPageLoad = false;
                } else {
                    this.chat.loadingBottomPage = false;
                    this.chat._cancelBottomPageLoad = false;
                }
            });
    }

    dispose() {
        this._reactionsToDispose.forEach(d => d());
        tracker.unsubscribe(this.onMessageDigestUpdate);
    }
}

export default ChatMessageHandler;
