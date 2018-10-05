import MRUList from '~/helpers/mru-list';
import TinyDb from '~/db/tiny-db';
import StorageEngine from '~/models/storage/node-json-storage';
import config from '~/config';
import { observable } from 'mobx';

describe('MRU list helper should', () => {
    before(() => {
        config.StorageEngine = StorageEngine;
        const key = new Uint8Array(32);
        key.fill(Math.random());
        TinyDb.openUser('test', key);
    });

    it('order items by last added', () => {
        const list = new MRUList('testList', 3);
        list.addItem('1');
        list.addItem('2');
        list.addItem('3');

        const expected = observable(['3', '2', '1']);
        const actual = list.list;

        actual.should.deep.equal(expected);
    });

    it('delete items when size limit is exceeded', async () => {
        const list = new MRUList('testList', 3);
        list.addItem('1');
        list.addItem('2');
        list.addItem('3');
        list.addItem('4');
        list.addItem('5');

        const expected = observable(['5', '4', '3']);
        const actual = list.list;

        actual.should.deep.equal(expected);
    });
});
