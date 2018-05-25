const Timer = require('~/helpers/observable-timer');
const { when } = require('mobx');
const { performance } = require('perf_hooks');

describe('Timer should', () => {
    it('count down', (done) => {
        let timer = new Timer();
        const started = performance.now();
        timer.countDown(3);

        return when(() => timer.counter === 0, () => {
            timer.stop();
            timer = null;

            const ended = performance.now();
            const elapsed = ended - started;
            elapsed.should.be.above(2500).and.below(3500);

            done();
        });
    });

    it('count up', (done) => {
        let timer = new Timer();
        const started = performance.now();
        timer.countUp(3);

        return when(() => timer.counter === 10, () => {
            timer.stop();
            timer = null;

            const ended = performance.now();
            const elapsed = ended - started;
            elapsed.should.be.above(2500).and.below(3500);

            done();
        });
    });
});
