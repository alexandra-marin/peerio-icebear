const { retryUntilSuccess } = require('~/helpers/retry');
const tracker = require('~/models/update-tracker');
const { performance } = require('perf_hooks');

describe('Retry helper should', function() {
    this.timeout(50000);

    before(() => {
        tracker.updated = true;
    });

    it('resolve immediately', async () => {
        const task = () => new Promise((resolve) => {
            resolve();
        });

        await retryUntilSuccess(task).should.eventually.be.fulfilled;
    });

    it('reject 10 times and then resolve', async () => {
        let attemptNumber = 0;
        const task = () => new Promise((resolve, reject) => {
            attemptNumber++;
            console.log('Attempt no', attemptNumber);

            if (attemptNumber < 10) {
                reject();
            } else {
                resolve();
            }
        });

        await retryUntilSuccess(task).should.be.fulfilled;
    });

    it('fail to resolve after 5 tries', async () => {
        let attemptNumber = 0;
        const task = () => new Promise((resolve, reject) => {
            attemptNumber++;
            console.log('Attempt no', attemptNumber);
            reject();
        });

        await retryUntilSuccess(task, 'task 1', 5).should.be.rejected;
    });

    it('should add ~250ms for every failed try', async () => {
        let attemptNumber = 0;
        let started;
        let ended;
        const task = () => new Promise((resolve, reject) => {
            ended = performance.now();
            attemptNumber++;
            console.log('Attempt no', attemptNumber);

            if (attemptNumber < 2) {
                reject();
                started = performance.now();
            } else {
                resolve();
            }
        });

        await retryUntilSuccess(task).should.be.fulfilled;
        const timeout = ended - started;
        console.log(`Timeout took ${timeout} milliseconds.`);
        timeout.should.be.above(1200).and.below(1300);
    });
});

