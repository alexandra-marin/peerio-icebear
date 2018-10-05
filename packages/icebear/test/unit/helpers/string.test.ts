import { getFirstLetterUpperCase } from '~/helpers/string';

describe('String helper should', () => {
    it('return empty string for no input', () => {
        const name = null;

        const expected = '';
        const actual = getFirstLetterUpperCase(name);

        actual.should.equal(expected);
    });

    it('return first letter from word', () => {
        const name = 'icebear';

        const expected = 'I';
        const actual = getFirstLetterUpperCase(name);

        actual.should.equal(expected);
    });

    it('return first letter from symbol', () => {
        const name = '© Peerio';

        const expected = '©';
        const actual = getFirstLetterUpperCase(name);

        actual.should.equal(expected);
    });

    it('return first letter from emoji', () => {
        const name = '🦄⭐';

        const expected = '🦄';
        const actual = getFirstLetterUpperCase(name);

        actual.should.equal(expected);
    });
});
