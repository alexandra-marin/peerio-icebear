import { TinyDBStorageEngine } from '../../defs/tiny-db';

export default class MemoryStorage implements TinyDBStorageEngine {
    constructor(name: string) {
        this.name = name;
    }

    name: string;
    private data: { [key: string]: string } = {};

    // should return null if value doesn't exist
    async getValue(key) {
        // eslint-disable-next-line no-prototype-builtins
        return this.data.hasOwnProperty(key) ? this.data[key] : null;
    }

    async setValue(key, value) {
        this.data[key] = value;
    }

    async removeValue(key) {
        delete this.data[key];
    }

    async getAllKeys() {
        return Object.keys(this.data);
    }

    async clear() {
        this.data = {};
    }
}
