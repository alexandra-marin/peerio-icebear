import Keg from './../kegs/keg';
import { AntiTamperError } from '../../errors';
import KegDb from '../kegs/keg-db';

interface TofuPayload {
    username: string;
    firstName: string;
    lastName: string;
    encryptionPublicKey: string;
    signingPublicKey: string;
}
interface TofuProps {
    username: string;
}
/**
 * Tofu keg.
 */
export default class Tofu extends Keg<TofuPayload, TofuProps> {
    constructor(db: KegDb) {
        super(null, 'tofu', db);
    }

    username: string;
    firstName: string;
    lastName: string;
    encryptionPublicKey: string; // b64 encoded
    signingPublicKey: string; // b64 encoded

    serializeKegPayload() {
        return {
            username: this.username,
            firstName: this.firstName,
            lastName: this.lastName,
            encryptionPublicKey: this.encryptionPublicKey,
            signingPublicKey: this.signingPublicKey
        };
    }

    deserializeKegPayload(payload) {
        // we don't deserialize username here, because we want our detectTampering override to work
        // this.username = payload.username;
        this.firstName = payload.firstName;
        this.lastName = payload.lastName;
        this.encryptionPublicKey = payload.encryptionPublicKey;
        this.signingPublicKey = payload.signingPublicKey;
    }

    serializeProps() {
        return { username: this.username };
    }

    deserializeProps(props) {
        this.username = props.username;
    }

    detectTampering(payload) {
        super.detectTampering(payload);
        if (payload.username !== this.username) {
            throw new AntiTamperError(
                'Tofu keg inner and outer username mismatch. ' +
                    `Inner: ${payload.username}. Outer: ${this.username}`
            );
        }
    }
}
