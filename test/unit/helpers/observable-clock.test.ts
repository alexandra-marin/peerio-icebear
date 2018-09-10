import Clock from '~/helpers/observable-clock';
import { autorun } from 'mobx';

describe('Observable clock should', () => {
    it('not tick if not observed', () => {
        const clock = new Clock(60);
        const expected = clock.now;
        const actual = Date.now();

        actual.should.equal(expected);
        clock._atom.reportObserved().should.be.false;
    });

    it('tick if observed', async () => {
        const clock = new Clock(1);

        const disposer = autorun(() => {
            const expected = clock.now;
            const actual = Date.now();

            actual.should.closeTo(expected, 30);
            clock._atom.reportObserved().should.be.true;
        });

        await Promise.delay(3000).then(disposer);
        clock._atom.reportObserved().should.be.false;
    });
});
