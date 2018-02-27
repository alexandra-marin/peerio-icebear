const Timer = require('~/helpers/observable-timer');
const { when } = require('mobx');
const { performance } = require('perf_hooks');

describe('Timer should', () => {
    it('count down', (done) => {
        let timer = new Timer();
        const started = performance.now();
        timer.countDown(10);

        return when(() => timer.counter === 0, () => {
            timer.stop();
            timer = null;

            const ended = performance.now();
            const elapsed = ended - started;
            console.log(`Clock ran for ${elapsed} milliseconds.`);
            elapsed.should.be.above(9950).and.below(10050);

            done();
        });
    });

    it('count up', (done) => {
        let timer = new Timer();
        const started = performance.now();
        timer.countUp(10);

        return when(() => timer.counter === 10, () => {
            timer.stop();
            timer = null;

            const ended = performance.now();
            const elapsed = ended - started;
            console.log(`Clock ran for ${elapsed} milliseconds.`);
            elapsed.should.be.above(9950).and.below(10050);

            done();
        });
    });
});
