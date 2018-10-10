import createMap from '~/helpers/dynamic-array-map';
import { when, observable, keys } from 'mobx';

describe('createMap should', () => {
    it('notify when items are added', done => {
        const arr = observable([{ files: 1 }, { files: 2 }, { files: 3 }]);
        const map = createMap(arr, 'files');

        when(() => keys(map.observableMap).length === 4, done);
        arr.push({ files: 4 });
    });

    it('notify when items are deleted', done => {
        const arr = observable([{ files: 1 }, { files: 2 }, { files: 3 }]);
        const map = createMap(arr, 'files');

        when(() => keys(map.observableMap).length === 2, done);
        arr.pop();
    });
});
