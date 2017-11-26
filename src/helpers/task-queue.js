const { computed, observable, action } = require('mobx');

/**
 * Observable task queue implementation
 * @param {number} [parallelism=1] - how many tasks can run(wait to be finished) at the same time
 * @param {number} [throttle=0] - how many milliseconds delay to make before running every task
 * @class TaskQueue
 * @public
 */
class TaskQueue {
    /**
     * @readonly
     */
    paused = false;
    /**
     * List of tasks in queue. Running tasks are not here.
     * @member {ObservableArray<function>} tasks
     * @memberof TaskQueue
     * @instance
     * @public
     */
    @observable.shallow tasks = [];
    /**
     * Amount of currently running tasks
     * @member {Observable<number>} runningTasks
     * @memberof TaskQueue
     * @instance
     * @public
     */
    @observable runningTasks = 0;
    /**
     * Amount of currently running tasks + tasks in queue
     * @member {Computed<number>} length
     * @memberof TaskQueue
     * @instance
     * @public
     */
    @computed get length() {
        return this.tasks.length + this.runningTasks;
    }

    constructor(parallelism, throttle) {
        this.parallelism = parallelism || 1;
        this.throttle = throttle || 0;
    }

    /**
     * Adds task to the queue.
     * Depending on return value task will be considered finished right after exit from the function or
     * after returned promise is fulfilled.
     * @function addTask
     * @param {function} task - function to run
     * @param {Object} [context] - 'this' context to execute the task with
     * @param {Array<any>} [args] - arguments to pass to the task
     * @param {callback} [onSuccess] - callback will be executed as soon as task is finished without error
     * @param {callback<Error>} [onError] - callback will be executed if task throws or rejects promise
     * @returns {Promise}
     * @memberof TaskQueue
     * @instance
     * @public
     */
    @action addTask(task, context, args, onSuccess, onError) {
        return new Promise((resolve, reject) => {
            this.tasks.push({
                task,
                context,
                args,
                onSuccess: (...finishArgs) => {
                    resolve(...finishArgs);
                    if (onSuccess) onSuccess(...finishArgs);
                },
                onError: (...errArgs) => {
                    reject(...errArgs); // eslint-disable-line prefer-promise-reject-errors
                    if (onError) onError(...errArgs);
                }
            });
            if (!this.paused) setTimeout(this.runTask, this.throttle);
        });
    }

    /**
     * Runs the next task in queue if it is possible
     * @function runTask
     * @memberof TaskQueue
     * @instance
     * @private
     */
    @action.bound runTask() {
        if (this.paused) return;
        // if reached the limit of parallel running tasks or no tasks left - doing nothing
        if (this.parallelism <= this.runningTasks || this.tasks.length === 0) return;
        this.runningTasks++;
        let t;
        try {
            t = this.tasks.shift();
            let ret = t.task.apply(t.context, t.args);
            if (ret instanceof Promise) {
                // task is considered done when promise is complete
                ret = ret.then(t.onSuccess);
                ret = ret.catch(t.onError);
                ret = ret.finally(this.onTaskComplete);
                return;
            }
            // otherwise we assume the task was synchronous
            if (t.onSuccess) t.onSuccess();
            this.onTaskComplete();
        } catch (ex) {
            // in case something went wrong we schedule next task
            console.error(ex);
            if (t.onError) t.onError(ex);
            this.onTaskComplete();
        }
    }

    /**
     * Performs necessary actions when a task is finished
     * @function onTaskComplete
     * @memberof TaskQueue
     * @instance
     * @private
     */
    @action.bound onTaskComplete() {
        this.runningTasks--;
        if (this.paused) return;
        for (let i = this.runningTasks; i < this.parallelism; i++) {
            setTimeout(this.runTask, this.throttle);
        }
    }

    pause() {
        this.paused = true;
    }
    resume() {
        if (!this.paused) return;
        this.paused = false;
        for (let i = this.runningTasks; i < this.parallelism; i++) {
            setTimeout(this.runTask, this.throttle);
        }
    }
}

module.exports = TaskQueue;
