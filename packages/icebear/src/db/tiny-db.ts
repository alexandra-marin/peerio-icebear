import config from '../config';
import TinyDbManager from './tiny-db-manager';

/**
 * TinyDb is an global instance of TinyDbManager
 * with storage engine specified in config.
 *
 * @example
 * // at any time use unencrypted shared collection
 * TinyDb.system.getValue('lastAuthenticatedUsername');
 * @example
 * // after successful login use User's personal encrypted database.
 * // Only values are encrypted.
 * TinyDb.user.setValue('lastUsedEmoji',':grumpy_cat:')
 */
const TinyDb = new TinyDbManager(name => new config.StorageEngine(name));

export default TinyDb;
