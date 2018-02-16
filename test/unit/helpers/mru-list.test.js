const MRUList = require('~/helpers/mru-list');
const TinyDb = require('~/db/tiny-db');
const StorageEngine = require('~/models/storage/node-json-storage');
const config = require('~./config');
const { observable } = require('mobx');

describe('MRU list helper should', () => {
    before(() => {
        config.StorageEngine = StorageEngine;
        TinyDb.openUser('test', 'test');
    });

    it('order items by last added', () => {
        const list = new MRUList('testList', 3);
        list.addItem(1);
        list.addItem(2);
        list.addItem(3);

        const expected = observable([3, 2, 1]);
        const actual = list.list;

        actual.should.deep.equal(expected);
    });

    it('delete items when size limit is exceeded', async () => {
        const list = new MRUList('testList', 3);
        list.addItem(1);
        list.addItem(2);
        list.addItem(3);
        list.addItem(4);
        list.addItem(5);

        const expected = observable([5, 4, 3]);
        const actual = list.list;

        actual.should.deep.equal(expected);
    });
});

