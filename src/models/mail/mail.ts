// import moment from 'moment';
// import Keg from './../kegs/keg';
// import { observable, computed, action } from 'mobx';
// import { cryptoUtil, secret } from '../../crypto';
// import socket from '../../network/socket';
// import { getUser } from '../../helpers/di-current-user';
// import { retryUntilSuccess } from '../../helpers/retry';

// class Mail extends Keg {
//     constructor(db) {
//         super(null, 'mail', db);
//     }

//     // -- Model data
//     // ---------------------------------------------------------------------------------------------
//     // When sending a message, the sender assigns a random messageId to it and
//     // recipients receive the message with this messageId.
//     //
//     // After sending it, the sender also saves the message for themselves (to
//     // implement "Sent" folder or threading), but changes messageId to a new
//     // random value and assigns the previously used sent messageId to sentId to
//     // keep track of which messages it was corresponding to. The presence of
//     // sentId also indicates that this message is outgoing.
//     @observable messageId = null;
//     @observable sentId = null;

//     // If the message is a reply to some message, replyId is assigned
//     // to this source message's messageId.
//     @observable replyId = null;

//     @observable subject = '';
//     @observable body = '';
//     @observable timestamp = Date.now();

//     @observable sender;
//     @observable.shallow recipients = [];
//     @observable.shallow files = [];

//     // -- View state data ----------------------------------------------------------------------------------------
//     // is this message sending
//     @observable sending = false;
//     // was this message sent
//     @observable sent = false;
//     // is this mail selected
//     @observable selected = false;
//     // is this mail visible or filtered by search
//     @observable show = true;
//     // is this mail deleted
//     @observable deleted = false;

//     // -- computed properties ------------------------------------------------------------------------------------

//     @computed
//     get date() {
//         return moment(this.timestamp);
//     }

//     @computed
//     get fileCounter() {
//         return this.files.length;
//     }

//     // -- keg serializators --------------------------------------------------------------------------------------
//     serializeKegPayload() {
//         const ret = {
//             messageId: this.messageId,
//             recipients: this.recipients,
//             subject: this.subject,
//             body: this.body,
//             files: this.files.slice(),
//             timestamp: this.timestamp
//         };
//         if (this.sentId) ret.sentId = this.sentId;
//         if (this.replyId) ret.replyId = this.replyId;
//         return ret;
//     }

//     @action
//     deserializeKegPayload(data) {
//         this.messageId = data.messageId;
//         this.sentId = data.sentId;
//         this.replyId = data.replyId;
//         this.recipients = data.recipients;
//         this.subject = data.subject;
//         this.body = data.body;
//         this.files = data.files;
//         this.timestamp = data.timestamp;
//     }

//     serializeProps() {
//         const ret = {};
//         ret.messageId = this.messageId;
//         ret.recipients = JSON.stringify(this.recipients);
//         if (this.sentId) ret.sentId = this.sentId;
//         if (this.replyId) ret.replyId = this.replyId;
//         if (this.files) ret.files = JSON.stringify(this.files);
//         return ret;
//     }

//     @action
//     deserializeProps(props) {
//         // The source of truth for messageId, sentId, replyId, files, and
//         // recipients is the payload, so we don't deserialize them here.
//         this.sender = props.sharedBy;
//     }

//     // -- class methods ------------------------------------------------------------------------------------------
//     @action
//     send(contacts) {
//         this.sending = true;
//         this.timestamp = Date.now();
//         this.sender = getUser().username;
//         this.assignTemporaryId();
//         this.messageId = cryptoUtil.getRandomUserSpecificIdB64(this.sender);
//         this.recipients = contacts.map(c => c.username);

//         // Generate a new random payload key.
//         const payloadKey = cryptoUtil.getRandomBytes(32);

//         // Serialize payload.
//         const payload = JSON.stringify(this.serializeKegPayload());

//         // Encrypt payload with the payload key.
//         const encryptedPayload = secret.encryptString(payload, payloadKey);

//         // Encrypt message key for each recipient's public key.
//         //
//         // {
//         //   "user1": { "publicKey": ..., "encryptedKey": ... },
//         //   "user2": { "publicKey": ..., "encryptedKey": ... }
//         //   ...
//         //  }
//         //
//         const recipients = {};
//         contacts.forEach(contact => {
//             recipients[contact.username] = {
//                 publicKey: cryptoUtil.bytesToB64(contact.encryptionPublicKey),
//                 encryptedPayloadKey: cryptoUtil.bytesToB64(
//                     secret.encryptString(
//                         payloadKey,
//                         getUser().getSharedKey(contact.encryptionPublicKey)
//                     )
//                 )
//             };
//         });

//         const data = {
//             recipients,
//             keg: {
//                 type: this.type,
//                 payload: encryptedPayload.buffer,
//                 props: this.serializeProps()
//             }
//         };

//         // when we implement key change history, this will help to figure out which key to use
//         // this properties should not be blindly trusted, recipient verifies them
//         data.keg.props.sharedKegSenderPK = cryptoUtil.bytesToB64(
//             getUser().encryptionKeys.publicKey
//         );

//         return retryUntilSuccess(() => socket.send('/auth/kegs/send', data))
//             .then(() => {
//                 this.sent = true;
//                 // Save an outgoing copy, changing ids.
//                 this.sentId = this.messageId;
//                 this.messageId = cryptoUtil.getRandomUserSpecificIdB64(this.sender);
//                 return retryUntilSuccess(() => this.saveToServer());
//             })
//             .finally(
//                 action(() => {
//                     this.sending = false;
//                 })
//             );
//     }

//     remove() {
//         if (!this.id) return Promise.resolve();
//         return retryUntilSuccess(() => super.remove(), `remove mail ${this.id}`).then(() => {
//             this.deleted = true;
//         });
//     }
// }

// export default Mail;
