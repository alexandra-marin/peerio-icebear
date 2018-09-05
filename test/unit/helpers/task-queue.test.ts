import { Promise } from 'bluebird';
import TaskQueue from '~/helpers/task-queue';

describe('TaskQueue should', () => {
    it('do tasks in order', async () => {
        const shareQueue = new TaskQueue(10);
        const results = [];

        shareQueue.addTask(() => {
            results.push(1);
        });

        shareQueue.addTask(() => {
            return Promise.delay(500).then(() => results.push(3));
        });

        shareQueue.addTask(() => {
            results.push(2);
        });

        await Promise.delay(1000);
        results.should.deep.equal([1, 2, 3]);
    });

    it('not execute tasks when paused', async () => {
        const shareQueue = new TaskQueue(10);
        const results = [];

        shareQueue.pause();

        shareQueue.addTask(() => {
            results.push(1);
        });

        await Promise.delay(1000);
        results.should.be.empty;
    });

    it('throttle', async () => {
        const shareQueue = new TaskQueue(10, 1000);
        const results = [];

        shareQueue.addTask(() => {
            results.push(1);
        });

        shareQueue.addTask(() => {
            results.push(2);
        });

        shareQueue.addTask(() => {
            return Promise.delay(500).then(() => results.push(3));
        });

        results.should.be.empty;

        await Promise.delay(1000);
        results.should.deep.equal([1, 2]);

        await Promise.delay(500);
        results.should.deep.equal([1, 2, 3]);
    });
});
