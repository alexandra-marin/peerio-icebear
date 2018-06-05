/**
 * DI module to use models/user avoiding cyclic requires
 */
let currentUser;
module.exports = {
    /**
     * Only User module uses this
     */
    setUser(user) {
        currentUser = user;
    },
    /**
     * Use this to avoid cyclic requires
     * @returns {User}
     */
    getUser() {
        return currentUser;
    }
};
