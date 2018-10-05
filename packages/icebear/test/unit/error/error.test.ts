import * as errors from '~/errors';

describe('Peerio errors module', () => {
    it('should normalize errors', () => {
        const expected = new Error('test');
        const actual = errors.normalize(expected);
        actual.should.equal(expected);
    });

    it('should normalize strings to errors', () => {
        const expected = 'test';
        const actual = errors.normalize(expected);
        actual.should.be.instanceof(Error);
        actual.message.should.equal(expected);
    });

    it('should normalize objects to errors', () => {
        const expected = { test: 1 };
        const actual = errors.normalize(expected);
        actual.should.be.instanceof(Error);
        actual.message.should.equal(JSON.stringify(expected));
    });

    it('should normalize strings to errors with failover', () => {
        const expected = 'test';
        const actual = errors.normalize('message', expected);
        actual.should.be.instanceof(Error);
        actual.message.should.equal(expected);
    });
});
