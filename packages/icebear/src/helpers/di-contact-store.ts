import { ContactStore } from '../models/contacts/contact-store';

/**
 * DI module to use models and stores avoiding cyclic requires
 */
let contactStore;

/**
 * This is used by ContactStore module only
 */
export function setContactStore(store: ContactStore) {
    contactStore = store;
}
/**
 * Use this from icebear when u want to avoid cyclic require
 * @returns contact store instance
 */
export function getContactStore(): ContactStore {
    return contactStore;
}
