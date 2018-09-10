import SharedKegDb from '../kegs/shared-keg-db';

/*
 * KegDB for volumes.
 */
class VolumeKegDb extends SharedKegDb {
    constructor(id, participants = []) {
        super(id, participants, true);
    }

    get urlName() {
        return 'volume';
    }
}

export default VolumeKegDb;
