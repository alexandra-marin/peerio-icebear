import User from '../models/user/user';

/**
 * DI module to use models/user avoiding cyclic requires
 */
let currentUser;

/**
 * Only User module uses this
 */
export function setUser(user: User) {
    currentUser = user;
}
/**
 * Use this to avoid cyclic requires
 * @returns current user instance
 */
export function getUser(): User {
    return currentUser;
}
