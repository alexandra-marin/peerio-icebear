const { observable } = require('mobx');
const { socket, crypto } = require('peerio-icebear');
const OrderedFormStore = require('~/stores/ordered-form-store');

class ProfileStore extends OrderedFormStore {
    @observable fieldsExpected = 4;

    @observable username = ''; // also has observables usernameValid, usernameDirty
    @observable email = ''; // also has emailValid, emailDirty
    @observable firstName = ''; // etc
    @observable lastName = ''; // etc
    @observable passphrase = '';
    @observable keyBackedUp = false;
    @observable confirmedKeyBackup = false;
    @observable subscribeNewsletter = false;
    @observable consentUsageData = false;

    rerollPassphrase() {
        this.passphrase = crypto.keys.getRandomAccountKeyHex(); // PhraseDictionary.current.getPassphrase(8);
    }

    get hasErrors() {
        return !(
            this.initialized &&
            this.usernameValid &&
            this.emailValid &&
            this.firstNameValid &&
            this.lastNameValid &&
            socket.connected
        );
    }
}

module.exports = ProfileStore;
