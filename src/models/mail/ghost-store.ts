// import _ from 'lodash';
// import { observable, action, computed } from 'mobx';
// import socket from '../../network/socket';
// import Ghost from './ghost';
// import User from '../user/user';
// import tracker from '../update-tracker';
// import warnings from '../warnings';

// class GhostStore {
//     constructor() {
//         this.updateGhosts = this.updateGhosts.bind(this);
//         this.loadAllGhosts = this.loadAllGhosts.bind(this);
//     }

//     @observable.shallow ghosts = []; // sorted array
//     @observable ghostMap = observable.shallowMap({}); // ghost by ghostId
//     @observable loading = false;
//     @observable loaded = false;
//     @observable updating = false;
//     @observable selectedId = null; // ghostId
//     @observable selectedSort = 'kegId';

//     @computed
//     get selectedGhost() {
//         return this.ghostMap.get(this.selectedId);
//     }

//     /**
//      * Fetch ghosts from the server.
//      */
//     _getGhosts(minCollectionVersion = '') {
//         const filter = { minCollectionVersion };
//         if (minCollectionVersion === '') {
//             filter.deleted = false;
//         }
//         return socket.send('/auth/kegs/db/list-ext', {
//             kegDbId: 'SELF',
//             options: {
//                 type: 'ghost',
//                 reverse: false
//             },
//             filter
//         });
//     }

//     /*
//      * Load all ghosts.
//      */
//     loadAllGhosts() {
//         if (this.loading || this.loaded) return;
//         this.loading = true;
//         this._getGhosts()
//             .then(
//                 action(async resp => {
//                     const { kegs } = resp;
//                     console.log('there are mail kegs', kegs.length);
//                     for (const keg of kegs) {
//                         const ghost = new Ghost(User.current.kegDb);
//                         if (keg.collectionVersion > this.knownCollectionVersion) {
//                             this.knownCollectionVersion = keg.collectionVersion;
//                         }
//                         if (await ghost.loadFromKeg(keg)) {
//                             console.log('loading ghost', ghost.ghostId);
//                             this.ghostMap.set(ghost.ghostId, ghost);
//                         }
//                     }
//                     this.sort(this.selectedSort);
//                     this.loading = false;
//                     this.loaded = true;
//                     tracker.subscribeToKegUpdates('SELF', 'ghost', this.updateGhosts);
//                 })
//             )
//             .catch(err => {
//                 console.error('Failed to load ghosts:', err);
//             });
//     }

//     /**
//      * Update when server sends an update to the collection.
//      */
//     updateGhosts() {
//         if (this.updating || this.loading) return;
//         this.updating = true;
//         this._getGhosts().then(
//             action(async kegs => {
//                 for (const keg of kegs) {
//                     const inCollection = this.getById(keg.props.ghostId);
//                     const g = inCollection || new Ghost(User.current.kegDb);
//                     if (keg.collectionVersion > this.knownCollectionVersion) {
//                         this.knownCollectionVersion = keg.collectionVersion;
//                     }
//                     if (!(await g.loadFromKeg(keg)) || g.isEmpty) continue;
//                     if (!g.deleted && !inCollection) this.ghostMap.set(g.ghostId, g);
//                     if (g.deleted && inCollection) this.ghostMap.delete(keg.ghostId);
//                 }
//                 this.sort(this.selectedSort);
//                 this.updating = false;
//             })
//         );
//     }

//     /**
//      * Create a new ghost.
//      */
//     createGhost() {
//         const g = new Ghost(User.current.kegDb);
//         this.ghostMap.set(g.ghostId, g);
//         this.ghosts.unshift(g);
//         this.selectedId = g.ghostId;
//         return g;
//     }

//     /**
//      * Send a new ghost
//      */
//     send(g, text) {
//         return g
//             .send(text)
//             .catch(() => {
//                 // TODO: global error handling
//                 warnings.addSevere('error_mailQuotaExceeded', 'error_sendingMail');
//             })
//             .finally(() => g.sendError && this.remove(g));
//     }

//     /** Just remove from kegs */
//     remove(g: Ghost) {
//         // if the ghost weren't successfully saved to server (quota exceeded)
//         if (!g.id) {
//             this.ghostMap.delete(g.ghostId);
//             const i = this.ghosts.indexOf(g);
//             i !== -1 && this.ghosts.splice(i, 1);
//             return Promise.resolve();
//         }
//         return g.remove();
//     }

//     /**
//      * Get a ghost by its ghostId.
//      */
//     getById(ghostId: string) {
//         return this.ghostMap.get(ghostId);
//     }

//     /**
//      * Apply a sort
//      *
//      * Possible values:
//      *  attachment, recipient, date, kegId
//      * Default: kegId
//      */
//     @action
//     sort(value) {
//         switch (value) {
//             case 'attachment':
//                 this.sortByAttachments();
//                 break;
//             case 'recipient':
//                 this.sortByRecipient();
//                 break;
//             case 'date':
//                 this.sortByDate();
//                 break;
//             default:
//                 this.sortByKegId();
//         }
//         if (this.ghosts.length === 0) return;
//         this.selectedId = this.ghosts[0].ghostId;
//     }

//     /**
//      * Sort by kegId, ascending.
//      */
//     sortByKegId() {
//         this.ghosts = _.sortBy(this.ghostMap.toJS(), g => g.id);
//         this.selectedSort = 'kegId';
//     }

//     /**
//      * Sort by sent date, descending.
//      */
//     sortByDate() {
//         this.ghosts = _.sortBy(this.ghostMap.toJS(), g => -g.timestamp);
//         this.selectedSort = 'date';
//     }

//     /**
//      * Sort by whether files have attachments.
//      */
//     sortByAttachments() {
//         this.ghosts = _.sortBy(this.ghostMap.toJS(), g => g.files.length === 0);
//         this.selectedSort = 'attachment';
//     }

//     /**
//      * Sort by the first recipient.
//      * @fixme this doesn't make much sense?
//      */
//     sortByRecipient() {
//         this.ghosts = _.sortBy(this.ghostMap.toJS(), g => g.recipients[0]);
//         this.selectedSort = 'recipient';
//     }
// }

// export default new GhostStore();
