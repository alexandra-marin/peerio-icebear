const { observable } = require('mobx');
const { asPromise } = require('~/helpers/prombservable');

describe('Promservable should', () => {
    it('execute when property changes', () => {
        class Chats {
            @observable loaded = false;
        }

        const chats = new Chats();
        const promise = asPromise(chats, 'loaded', true);
        chats.loaded = true;

        return promise.should.be.fulfilled;
    });
});
