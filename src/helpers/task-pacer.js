/**
 * Controls the execution rate of tasks by deferring execution.
 * Important notes:
 * - Tasks will always get executed asynchronously
 * - Execution order of the tasks will be the same
 * - It's ok for tasks to throw
 * @param {number} rate - how many tasks are allowed to execute in 1 second interval
 * @class TaskPacer
 */
class TaskPacer {
    constructor(rate) {
        if (!rate) throw new Error('Task execution rate is not specified.');
        this.rate = rate;
    }

    // last task execution stat time, milliseconds will be set to 0
    lastRunTimestamp = 0;
    // how many tasks has been executed in the current second
    runCount = 0;
    // all tasks go through this queue
    queue = [];
    // to see if we need to restart task runner after it was stopped last time queue got empty
    taskRunnerIsUp = false;
    /**
     * Executes a task immediately or as soon as chosen execution pace allows it
     * @param {function} task
     */
    run(task) {
        this.queue.push(task);
        if (!this.taskRunnerIsUp) {
            this.taskRunnerIsUp = true;
            setTimeout(this.taskRunner);
        }
    }

    logError(err) {
        console.error(err);
    }

    taskRunner = () => {
        if (!this.queue.length) {
            this.taskRunnerIsUp = false;
            return;
        }
        this.taskRunnerIsUp = true;
        // how many milliseconds have passed?
        const diff = Date.now() - this.lastRunTimestamp;
        if (diff < 1000) {
            if (++this.runCount > this.rate) {
                console.log('Task pacer hit.', 'next run in', 1000 - diff, 'ms');
                setTimeout(this.taskRunner, 1000 - diff); // deferring execution to the next second
                return;
            }
        } else {
            this.runCount = 0;
            this.lastRunTimestamp = Math.trunc(Date.now() / 1000) * 1000;
        }
        const task = this.queue.shift();
        try {
            const res = task();
            if (res instanceof Promise) {
                res.catch(this.logError);
            }
        } catch (err) {
            this.logError(err);
        }
        if (this.queue.length) setTimeout(this.taskRunner);
        else this.taskRunnerIsUp = false;
    }
}

module.exports = TaskPacer;
