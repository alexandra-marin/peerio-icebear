import BootKeg from './boot-keg';
import tracker from '../../models/update-tracker';
import { KeyPair, IKegDb } from '../../defs/interfaces';

/**
 * Keg database.
 * This class is for user's own database ('SELF')
 */
export default class KegDb implements IKegDb {
    /**
     * Always equals 'SELF'
     */
    readonly id = 'SELF';

    /**
     * Database key to use for keg encryption.
     */
    key: Uint8Array;

    /**
     * Current key id for the database
     */
    get keyId(): string | null {
        return this.boot ? this.boot.kegKeyId : null;
    }

    boot: BootKeg;

    /**
     * Creates boot keg for this database.
     * todo: when we will have key change, we'll need update operation load()->update() because of keg version
     * TODO: args are not really optional, but it breaks type compatibility otherwise
     */
    createBootKeg(
        bootKey?: Uint8Array,
        signKeys?: KeyPair,
        encryptionKeys?: KeyPair,
        kegKey?: Uint8Array
    ) {
        console.log('Creating boot keg of "SELF".');
        const boot = new BootKeg(this, bootKey);
        Object.assign(boot, {
            signKeys,
            encryptionKeys,
            kegKey
        });
        boot.keys['0'] = { key: kegKey, createdAt: Date.now() };
        this.key = kegKey;
        this.boot = boot;
        return boot.saveToServer();
    }

    /**
     * Retrieves boot keg for the db and initializes this KegDb instance with required data.
     */
    loadBootKeg(bootKey: Uint8Array) {
        console.log('Loading boot keg of "SELF".');
        const boot = new BootKeg(this, bootKey);
        this.boot = boot;
        return boot.load().then(() => {
            this.key = boot.kegKey;
            tracker.seenThis('SELF', 'boot', boot.collectionVersion);
        });
    }

    /**
     * Custom JSON representation to avoid cycles when
     * doing JSON.stringify() on kegs.
     */
    toJSON() {
        return {
            id: this.id,
            key: this.key
        };
    }
}
