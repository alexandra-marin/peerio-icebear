import SyncedKeg from '../kegs/synced-keg';
import { getUser } from '../../helpers/di-current-user';

interface MyChatsPayload {}
interface MyChatsProps {}

/**
 * MyChats keg holds chat groups for user.
 */
class MyChats extends SyncedKeg<MyChatsPayload, MyChatsProps> {
    constructor() {
        super('my_chats', getUser().kegDb);
    }
    /**
     * Favorite chat ids
     */
    favorites: string[] = [];
    /**
     * Hidden chat ids
     */
    hidden: string[] = [];

    serializeKegPayload() {
        return {
            favorites: this.favorites,
            hidden: this.hidden
        };
    }

    deserializeKegPayload(payload) {
        this.favorites = payload.favorites;
        this.hidden = payload.hidden;
    }

    _add(array, value) {
        if (array.indexOf(value) >= 0) return false;
        array.push(value);
        return true;
    }

    _remove(array, value) {
        const ind = array.indexOf(value);
        if (ind >= 0) {
            array.splice(ind, 1);
            return true;
        }
        return false;
    }
    /**
     * Adds favorite chat and removes it from hidden list if it was there.
     * @returns true - if added, false - if already had been in the list
     */
    addFavorite(chatId: string) {
        const ret = this._add(this.favorites, chatId);
        if (ret) {
            this.removeHidden(chatId);
        }
        return ret;
    }

    /**
     * Removes favorite chat,
     * @returns true - if removed, false - if couldn't find it in the favorites list
     */
    removeFavorite(chatId: string) {
        return this._remove(this.favorites, chatId);
    }

    /**
     * Adds hidden chat and removes it from favorites list if it was there.
     * @returns true - if added, false - if already had been in the list
     */
    addHidden(chatId: string) {
        const ret = this._add(this.hidden, chatId);
        if (ret) {
            this.removeFavorite(chatId);
        }
        return ret;
    }

    /**
     * Removes hidden chat.
     * @returns true - if removed, false - if couldn't find it in the hidden list
     */
    removeHidden(chatId: string) {
        return this._remove(this.hidden, chatId);
    }
}

export default MyChats;
