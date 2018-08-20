import { observable, action, computed } from 'mobx';
import socket from '../../network/socket';
import User from '../user/user';
import Mail from './mail';
import tracker from '../update-tracker';
import _ from 'lodash';
import { retryUntilSuccess } from '../../helpers/retry';

class MailStore {
    @observable.shallow mails = [];
    @observable loading = false;
    @observable currentFilter = '';
    loaded = false;
    updating = false;
    maxUpdateId = '';
    knownUpdateId = '';

    static isMailSelected(mail) {
        return mail.selected;
    }

    static isMailOutgoing(mail) {
        return !!mail.sentId;
    }

    static isMailIncoming(mail) {
        return !mail.sentId;
    }

    @computed
    get hasSelectedMails() {
        return this.mails.some(MailStore.isMailSelected);
    }

    @computed
    get allVisibleSelected() {
        for (let i = 0; i < this.mails.length; i++) {
            if (!this.mails[i].show) continue;
            if (this.mails[i].selected === false) return false;
        }
        return true;
    }

    @computed
    get selectedCount() {
        return this.mails.reduce((count, m) => count + (m.selected ? 1 : 0));
    }

    /*
     * Returns currently selected mails (mail.selected == true)
     * @returns {Array<Mail>}
     */
    getSelectedMails() {
        return this.mails.filter(MailStore.isMailSelected);
    }

    /*
     * Returns all incoming mails.
     * @returns {Array<Mail>}
     */
    getIncomingMails() {
        return this.mails.filter(MailStore.isMailIncoming);
    }

    /*
     * Returns all outgoing mails.
     * @returns {Array<Mail>}
     */
    getOutgoingMails() {
        return this.mails.filter(MailStore.isMailOutgoing);
    }

    /*
     * Deselects all mails
     */
    @action
    clearSelection() {
        for (let i = 0; i < this.mails.length; i++) {
            this.mails[i].selected = false;
        }
    }

    @action
    selectAll() {
        for (let i = 0; i < this.mails.length; i++) {
            const mail = this.mails[i];
            if (!mail.show) continue;
            this.mails[i].selected = true;
        }
    }

    // TODO: more filters

    @action
    filterBySubject(query) {
        this.currentFilter = query;
        const regex = new RegExp(_.escapeRegExp(query), 'i');
        for (let i = 0; i < this.mails.length; i++) {
            this.mails[i].show = regex.test(this.mails[i].subject);
            if (!this.mails[i].show) this.mails[i].selected = false;
        }
    }

    @action
    clearFilter() {
        this.currentFilter = '';
        for (let i = 0; i < this.mails.length; i++) {
            this.mails[i].show = true;
        }
    }

    constructor() {
        tracker.subscribeToKegUpdates('SELF', 'mail', () => {
            console.log('Mails update event received');
            this.onMailDigestUpdate();
        });
    }

    onMailDigestUpdate = _.throttle(() => {
        const digest = tracker.getDigest('SELF', 'mail');
        console.log(`Mail digest: ${JSON.stringify(digest)}`);
        if (digest.maxUpdateId === this.maxUpdateId) return;
        this.maxUpdateId = digest.maxUpdateId;
        this.updateMails(this.maxUpdateId);
    }, 1500);

    _getMails() {
        const filter = this.knownUpdateId
            ? { minCollectionVersion: this.knownUpdateId }
            : { deleted: false };

        return socket.send('/auth/kegs/db/list-ext', {
            kegDbId: 'SELF',
            options: {
                type: 'mail',
                reverse: false
            },
            filter
        });
    }

    loadAllMails() {
        if (this.loading || this.loaded) return;
        this.loading = true;
        retryUntilSuccess(() => this._getMails(), 'Initial mail list loading').then(
            action(async kegs => {
                for (const keg of kegs.kegs) {
                    const mail = new Mail(User.current.kegDb);
                    if (keg.collectionVersion > this.maxUpdateId) {
                        this.maxUpdateId = keg.collectionVersion;
                    }
                    if (keg.collectionVersion > this.knownUpdateId) {
                        this.knownUpdateId = keg.collectionVersion;
                    }
                    if (await mail.loadFromKeg(keg)) this.mails.unshift(mail);
                }
                this.loading = false;
                this.loaded = true;
                tracker.onUpdated(() => {
                    this.onMailDigestUpdate();
                });
                setTimeout(this.updateMails);
            })
        );
    }

    // this essentially does the same as loadAllMails but with filter,
    // we reserve this way of updating anyway for future, when we'll not gonna load entire mail list on start
    updateMails = maxId => {
        if (!this.loaded || this.updating) return;
        // eslint-disable-next-line no-param-reassign
        if (!maxId) maxId = this.maxUpdateId;
        console.log(`Proceeding to mail update. Known collection version: ${this.knownUpdateId}`);
        this.updating = true;
        retryUntilSuccess(() => this._getMails(), 'Updating mail list').then(
            action(async resp => {
                const { kegs } = resp;
                for (const keg of kegs) {
                    if (keg.collectionVersion > this.knownUpdateId) {
                        this.knownUpdateId = keg.collectionVersion;
                    }
                    const existing = this.getById(keg.props.messageId);
                    const mail = existing || new Mail(User.current.kegDb);
                    if (keg.deleted && existing) {
                        this.mails.remove(existing);
                        continue;
                    }
                    if (!(await mail.loadFromKeg(keg)) || mail.isEmpty) continue;
                    if (!mail.deleted && !existing) this.mails.unshift(mail);
                }
                this.updating = false;
                // need this bcs if u delete all mails knownUpdateId won't be set at all after initial load
                if (this.knownUpdateId < maxId) this.knownUpdateId = maxId;
                // in case we missed another event while updating
                if (kegs.length || (this.maxUpdateId && this.knownUpdateId < this.maxUpdateId)) {
                    setTimeout(this.updateMails);
                } else {
                    setTimeout(this.onMailDigestUpdate);
                }
            })
        );
    };

    // todo: mails map
    getById(messageId) {
        for (let i = 0; i < this.mails.length; i++) {
            if (this.mails[i].messageId === messageId) return this.mails[i];
        }
        return null;
    }

    /*
     * Send a message.
     *
     * @param {Array<Contact>} recipients
     * @param {string} subject
     * @param {string} body
     * @param {File[]?} optional, files to attach
     * @param {string?} optional, messageId of message to reply to
     */
    send(recipients, subject, body, files, replyId) {
        const keg = new Mail(User.current.kegDb);
        keg.recipients = recipients;
        keg.subject = subject;
        keg.body = body;
        keg.files = files;
        keg.replyId = replyId;

        keg.send(recipients);
        this.mails.unshift(keg);

        // XXX: what is this?
        // const disposer = when(() => keg.deleted, () => {
        //     this.mails.remove(keg);
        // });
        // when(() => keg.sent, () => { disposer(); });

        return keg;
    }

    /*
     * Remove message.
     *
     * @param {Mail} mail
     */
    remove(m) {
        if (!m.id) {
            const i = this.mails.indexOf(m);
            i !== -1 && this.mails.splice(i, 1);
            return Promise.resolve();
        }
        return m.remove();
    }
}

export default new MailStore();
