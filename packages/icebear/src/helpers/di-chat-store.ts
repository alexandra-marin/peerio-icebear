import { ChatStore } from '../models/chats/chat-store';

/**
 * DI module to use models and stores avoiding cyclic requires
 */
let chatStore;

/**
 * This is used by ChatStore module only
 */
export function setChatStore(store: ChatStore) {
    chatStore = store;
}
/**
 * Use this from icebear when u want to avoid cyclic require
 * @returns chat store instance
 */
export function getChatStore(): ChatStore {
    return chatStore;
}
