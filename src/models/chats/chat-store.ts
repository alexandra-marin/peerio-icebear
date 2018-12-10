import {
    observable,
    action,
    computed,
    reaction,
    autorun,
    isObservableArray,
    when,
    IObservableArray,
    runInAction
} from 'mobx';
import Chat from './chat';
import ChatStorePending from './chat-store.pending.js';
import ChatStoreSpaces from './chat-store.spaces.js';
import ChatStoreCache from './chat-store.cache.js';
import socket from '../../network/socket';
import tracker from '../update-tracker';
import EventEmitter from 'eventemitter3';
import * as _ from 'lodash';
import MyChats from '../chats/my-chats';
import TinyDb from '../../db/tiny-db';
import config from '../../config';
import { asPromise } from '../../helpers/prombservable';
import { getUser } from '../../helpers/di-current-user';
import warnings from '../warnings';
import { setChatStore } from '../../helpers/di-chat-store';
import * as cryptoUtil from '../../crypto/util';
import chatInviteStore from './chat-invite-store';
import dbListProvider from '../../helpers/keg-db-list-provider';
import File from '../files/file';

// Used for typechecking
// eslint-disable-next-line no-unused-vars
import Contact from '../contacts/contact';

/**
 * Chat store.
 */
export class ChatStore {
    constructor() {
        reaction(
            () => this.activeChat,
            chat => {
                if (chat) chat.loadMessages();
            }
        );

        autorun(
            () => {
                this.sortChats();
            },
            { delay: 500 }
        );
        socket.onceAuthenticated(async () => {
            this.unreadChatsAlwaysOnTop = !!(await TinyDb.user.getValue(
                'pref_unreadChatsAlwaysOnTop'
            ));
            autorun(
                () => {
                    TinyDb.user.setValue(
                        'pref_unreadChatsAlwaysOnTop',
                        this.unreadChatsAlwaysOnTop
                    );
                },
                { delay: 2000 }
            );
            await this.cache.open();
            this.loadAllChats();
        });
        socket.onceStarted(() => {
            socket.subscribe(socket.APP_EVENTS.channelDeleted, this.processChannelDeletedEvent);
        });
    }

    pending = new ChatStorePending(this);
    spaces = new ChatStoreSpaces(this);
    cache = new ChatStoreCache(this);

    // todo: not sure this little event emitter experiment should live
    EVENT_TYPES = {
        messagesReceived: 'messagesReceived',
        invitedToChannel: 'invitedToChannel'
    };

    events = new EventEmitter();

    /**
     * Working set of chats. Server might have more, but we display only these at any time.
     */
    @observable.shallow chats = [] as IObservableArray<Chat>;
    @observable unreadChatsAlwaysOnTop = false;

    /**
     * MyChats Keg
     */
    myChats: MyChats;

    /**
     * To prevent duplicates
     */
    chatMap: { [chatId: string]: Chat } = {};
    /**
     * True when chat list loading is in progress.
     */
    @observable loading = false;

    /**
     * True when all chats has been updated after reconnect
     */
    @computed
    get updatedAfterReconnect() {
        return this.chats.every(c => c.updatedAfterReconnect);
    }

    /**
     * currently selected/focused chat.
     */
    @observable activeChat: Chat = null;
    /**
     * Chats set this flag and UI should use it to prevent user from spam-clicking the 'hide' button
     */
    @observable hidingChat = false;
    /**
     * True when loadAllChats() was called and finished once already.
     */
    @observable loaded = false;

    /**
     * Total unread messages in all chats.
     */
    @computed
    get unreadMessages() {
        return this.chats.reduce((acc, curr) => acc + curr.unreadCount, 0);
    }

    /**
     * Subset of ChatStore#chats, contains direct message chats and pending DMs
     */
    @computed
    get directMessages() {
        return this.chats.filter(chat => !chat.isChannel);
    }

    /**
     * Subset of ChatStore#chats, contains only channel chats
     */
    @computed
    get channels() {
        if (!this.loaded) return [];
        return this.chats.filter(chat => chat.isChannel && chat.headLoaded);
    }

    /**
     * Does chat store have any channels or not.
     */
    @computed
    get hasChannels() {
        return !!this.channels.length;
    }

    /**
     * Number of unread messages and invitations
     */
    @computed
    get badgeCount() {
        return this.unreadMessages + chatInviteStore.received.length;
    }

    /**
     * List of user's channels and invites
     * TODO: typings/refactor
     */
    @computed
    get allRooms(): any[] {
        // continuation of the mess with concatenating very different things
        // probably better let UI do this, extracting interface or making union types seems like too much work for this
        const allRooms = (chatInviteStore.received as any[]).concat(this.channels.slice());
        allRooms.sort((a, b) => {
            const first = a.name || a.channelName;
            const second = b.name || b.channelName;
            return first.localeCompare(second);
        });

        return allRooms;
    }

    /**
     * List of chats that don't belong to a space
     */
    @computed
    get nonSpaceRooms(): Chat[] {
        return this.allRooms.filter(c => !c.isInSpace);
    }

    /**
     * Does smart and efficient 'in-place' sorting of observable array.
     * Note that ObservableArray#sort creates copy of the array. This function sorts in place.
     */
    sortChats() {
        if (this.loading) return;
        console.log('Chat list sorting.');
        const array = this.chats;
        for (let i = 1; i < array.length; i++) {
            const item = array[i];
            let indexHole = i;
            while (
                indexHole > 0 &&
                ChatStore.compareChats(array[indexHole - 1], item, this.unreadChatsAlwaysOnTop) > 0
            ) {
                array[indexHole] = array[--indexHole];
            }
            array[indexHole] = item;
        }
    }

    /**
     * Chat comparison function. Takes into account favorite status of the chat, timestamp and user preferences.
     */
    static compareChats(a: Chat, b: Chat, unreadOnTop: boolean): number {
        if (a.isChannel && !b.isChannel) {
            return -1;
        }
        if (!a.isChannel && b.isChannel) {
            return 1;
        }
        if (a.isChannel && b.isChannel) {
            return a.name.localeCompare(b.name);
        }
        if (a.isFavorite) {
            // favorite chats are sorted by name
            if (b.isFavorite) {
                return a.name.localeCompare(b.name);
            }
            // a is fav, b is not fav
            return -1;
        } else if (!b.isFavorite) {
            // if it is a pending DM
            if (a.isInvite) {
                if (b.isInvite) {
                    return a.name.localeCompare(b.name);
                }
                // a is pending dm, b is not
                return -1;
            } else if (b.isInvite) {
                // b is pending dm, a is not
                return 1;
            }
            // non favorite chats sort by a weird combination unread count and then by update time
            if (unreadOnTop) {
                // we want chats with unread count > 0 to always come first
                if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
            }
            // if both chats have unread message - then sort by update time
            const aMsg = a.mostRecentMessage;
            const bMsg = b.mostRecentMessage;
            if (!aMsg) {
                if (!bMsg) return 0;
                return 1;
            } else if (!bMsg) {
                return -1;
            }
            if (aMsg.timestamp > bMsg.timestamp) return -1;
            if (aMsg.timestamp < bMsg.timestamp) return 1;
            return 0;
        }
        // a is not fav, b is fav
        if (b.isFavorite) return 1;
        return 0;
    }

    processChannelDeletedEvent = data => {
        const chat = this.chatMap[data.kegDbId];
        if (!chat) return;
        if (!chat.deletedByMyself) {
            warnings.addSevere('title_kickedFromChannel', '', {
                name: chat.name
            });
        }
        this.unloadChat(chat);
    };

    onNewMessages = _.throttle(props => {
        this.events.emit(this.EVENT_TYPES.messagesReceived, props);
    }, 1000);

    onInvitedToChannel = props => {
        this.events.emit(this.EVENT_TYPES.invitedToChannel, props);
    };

    generateJitsiUrl() {
        const id = cryptoUtil.getRandomGlobalShortIdHex();
        return `https://meet.jit.si/${id}`;
    }

    /**
     * Adds chat to the list.
     * @param chat - chat id or Chat instance
     */
    @action.bound
    addChat(chat: string | Chat, noActivate = false) {
        if (!chat) throw new Error(`Invalid chat id. ${chat}`);
        let c;
        if (typeof chat === 'string') {
            if (
                chat === 'SELF' ||
                this.chatMap[chat] ||
                !(chat.startsWith('channel:') || chat.startsWith('chat:'))
            ) {
                return this.chatMap[chat];
            }
            c = new Chat(chat, undefined, this, chat.startsWith('channel:'));
        } else {
            c = chat;
            if (this.chatMap[c.id]) {
                console.error(
                    'Trying to add a copy of an instance of a chat that already exists.',
                    c.id
                );
                return this.chatMap[c.id];
            }
        }

        if (this.myChats.favorites.includes(c.id)) c.isFavorite = true;
        this.chatMap[c.id] = c;
        this.chats.push(c);
        c.added = true;
        // console.log('Added chat ', c.id);
        if (this.myChats.hiddenChats.includes(c.id)) c.unhide();
        c.loadMetadata()
            .then(() => c.loadMostRecentMessage())
            .then(() => this.pending.onChatAdded(c));
        if (this.loaded && !this.activeChat && !noActivate) this.activate(c.id);
        return c;
    }

    // takes current fav/hidden lists and makes sure store.chats reflect it
    // at first login this class and chat list loader will call this function once each making sure data is applied
    @action.bound
    applyMyChatsData() {
        // resetting fav state for every chat
        this.chats.forEach(chat => {
            chat.isFavorite = false;
        });
        // marking favs as such
        this.myChats.favorites.forEach(id => {
            const favchat = this.chatMap[id];
            if (!favchat) {
                // fav chat isn't loaded, probably got favorited on another device
                this.addChat(id);
            } else {
                favchat.isFavorite = true;
            }
        });
        setTimeout(() => {
            // hiding all hidden chats
            this.myChats.hiddenChats.forEach(id => {
                const chat = this.chatMap[id];
                if (chat) chat.hide();
            });
        }, 2000);
    }

    /**
     * Initial chats list loading, call once after login.
     *
     * Logic:
     * - load all favorite chats
     * - see if we have some limit left and load other unhidden chats
     * - see if digest contains some new chats that are not hidden
     *
     * ORDER OF THE STEPS IS IMPORTANT ON MANY LEVELS
     */
    @action
    async loadAllChats() {
        if (this.loaded || this.loading) return;
        this.loading = true;

        await tracker.waitUntilUpdated();

        // subscribe to future chats that will be created
        tracker.subscribeToKegDbAdded(this.addChat);

        // Loading my_chats keg
        this.myChats = new MyChats();
        this.myChats.onUpdated = this.applyMyChatsData;
        await asPromise(this.myChats, 'loaded', true);

        // loading favorite chats
        // ..... gonna happen in applyMyChatsData when fav list is loaded

        // loading all the channels
        const channels = await dbListProvider.getChannels();
        // loading the rest unhidden chats
        const dms = await dbListProvider.getDMs();

        // adding
        runInAction(() => {
            channels.forEach(id => this.addChat(id));
            // checking how many more chats we can load
            let chatsLeft = config.chat.maxInitialChats - this.myChats.favorites.length;
            for (const id of dms) {
                const d = tracker.getDigest(id, 'message');
                if (chatsLeft <= 0 && d.maxUpdateId === d.knownUpdateId) continue;
                if (this.myChats.favorites.includes(id)) continue;
                this.addChat(id);
                chatsLeft--;
            }
        });

        // waiting for most chats to load but up to a reasonable time
        await Promise.map(this.chats, chat =>
            chat.isChannel
                ? asPromise(chat, 'headLoaded', true)
                : asPromise(chat, 'metaLoaded', true)
        )
            .timeout(5000)
            .catch(() => {
                /* well, the rest will trigger re-render */
            });

        // 8. find out which chat to activate.
        const lastUsed = await TinyDb.user.getValue('lastUsedChat');
        if (lastUsed && this.chatMap[lastUsed]) this.activate(lastUsed);
        else if (this.chats.length) this.activate(this.chats[0].id);

        this.loading = false;
        this.loaded = true;

        // TODO: remove when kegdb add/remove will make it's way to digest
        dbListProvider.onDbAdded(id => this.addChat(id));
        dbListProvider.onDbRemoved(id => {
            this.processChannelDeletedEvent({ kegDbId: id });
        });
    }

    getSelflessParticipants(participants) {
        return participants.filter(p => !p.isMe);
    }

    /**
     * When starting new chat for a list of participants we need a way to check if it already is loaded without knowing
     * the chatId.
     */
    findCachedChatWithParticipants(participants: Contact[]): Chat | null {
        // validating participants
        if (!participants || !participants.length) {
            throw new Error('Can not start chat with no participants');
        }
        for (const p of participants) {
            if (p.loading || p.notFound) {
                throw new Error(
                    `Invalid participant: ${p.username}, loading:${p.loading}, found:${!p.notFound}`
                );
            }
        }
        // we don't want our own user in participants, it's handled on the lowest level only.
        // generally ui should assume current user is participant to everything
        const filteredParticipants = this.getSelflessParticipants(participants);
        // maybe we already have this chat cached
        for (const c of this.directMessages) {
            if (c.hasSameParticipants(filteredParticipants)) return c;
        }
        return null;
    }

    /**
     * Sets activeChat to first chat in list
     */
    @action.bound
    switchToFirstChat() {
        if (config.whiteLabel.name === 'medcryptor' && this.spaces.activeSpaceId) {
            const active = this.spaces.spacesList.find(
                x => x.spaceId === this.spaces.activeSpaceId
            );
            const chats = active.internalRooms.concat(active.patientRooms.slice());
            const chatId = chats.length ? chats[0].id : null;
            if (chatId) {
                this.activate(chatId);
                return;
            }
        }
        for (let i = 0; i < this.chats.length; i++) {
            const chat = this.chats[i];
            if (chat.leaving) continue;
            if (config.whiteLabel.name === 'medcryptor' && chat.isInSpace) continue;
            this.activate(chat.id);
            return;
        }
        this.deactivateCurrentChat();
    }

    /**
     * Starts new chat or loads existing one and
     * @param purpose - only for channels, not relevant for DMs
     * @param space - only to create a space
     * @returns  - can return null in case of paywall
     */
    @action
    async startChat(
        participants: Contact[] = [],
        isChannel = false,
        name?: string,
        purpose?: string,
        noActivate = false,
        space = null
    ): Promise<Chat | null> {
        const cached = isChannel ? null : this.findCachedChatWithParticipants(participants);
        if (cached) {
            if (!noActivate) this.activate(cached.id);
            return cached;
        }
        if (isChannel && getUser().channelsLeft === 0) {
            warnings.add('error_channelLimitReached');
            return null;
        }
        try {
            // we can't add participants before setting channel name because
            // server will trigger invites and send empty chat name to user
            let chat = new Chat(
                null,
                isChannel ? [] : this.getSelflessParticipants(participants),
                this,
                isChannel
            );
            await chat.loadMetadata();
            // There's a concurrency situation, because 'addChat' can be called before this
            // by the event from server (db added).
            // Event can arrive before this call not only as a result of our DM creation, but also
            // if we get lucky and our contact creates same DM right before we do.
            // That is why addChat returns the correct instance and we overwrite our chat variable.
            chat = this.addChat(chat);
            // in case instance has changed, otherwise resolves immediately
            await chat.loadMetadata();
            if (!noActivate) this.activate(chat.id);
            if (name) await chat.rename(name);
            if (space) await chat.setSpace(space);
            if (purpose) await chat.changePurpose(purpose);
            if (isChannel) {
                chat.addParticipants(this.getSelflessParticipants(participants));
            }
            return chat;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    /**
     * Activates the chat.
     * @param id - chat id
     */
    @action
    activate(id: string) {
        const chat = this.chatMap[id];
        if (!chat) return;
        TinyDb.user.setValue('lastUsedChat', id);
        if (this.activeChat) {
            this.activeChat.active = false;
        }
        chat.active = true;
        this.activeChat = chat;
    }

    /**
     * Deactivates currently active chat.
     */
    @action
    deactivateCurrentChat() {
        if (!this.activeChat) return;
        this.activeChat.active = false;
        this.activeChat = null;
    }

    /**
     * Can be used from file view.
     */
    @action
    async startChatAndShareFiles(participants: Contact[], fileOrFiles: File | File[]) {
        const files =
            Array.isArray(fileOrFiles) || isObservableArray(fileOrFiles)
                ? (fileOrFiles as File[])
                : [fileOrFiles];
        const chat = await this.startChat(participants);
        if (!chat) return Promise.reject(new Error('Failed to create chat'));
        return chat.loadMetadata().then(() => {
            chat.shareFilesAndFolders(files);
            this.activate(chat.id);
        });
    }

    @action
    async startChatAndShareVolume(participant, volume) {
        const chat = await this.startChat([participant]);
        if (!chat) return Promise.reject(new Error('Failed to create chat'));
        await chat.loadMetadata();
        return chat.shareVolume(volume);
    }

    /**
     * Removes chat from working set.
     */
    @action.bound
    unloadChat(chat: Chat | string) {
        if (typeof chat === 'string') {
            chat = this.chatMap[chat]; // eslint-disable-line no-param-reassign
            if (!chat) return;
        }
        if (chat.active) {
            this.deactivateCurrentChat();
            // if not in timeout it will set activeChat again
            setTimeout(() => this.switchToFirstChat());
        }
        chat.dispose();
        delete this.chatMap[chat.id];
        this.chats.remove(chat);
    }

    /**
     * Returns a promise that resolves with chat instance once that chat is added to chat store and loaded.
     * @param id - chat id
     */
    getChatWhenReady(id: string): Promise<Chat> {
        return new Promise(resolve => {
            when(
                () => {
                    const chat = this.chats.find(c => c.id === id);
                    return !!(chat && chat.metaLoaded);
                },
                () => resolve(this.chatMap[id])
            );
        });
    }
}
const store = new ChatStore();
setChatStore(store);
export default store;
