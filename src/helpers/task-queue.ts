import { computed, observable, action, IObservableArray } from 'mobx';

interface TaskInfo {
    task: () => any;
    context: {};
    args: any[];
    onSuccess: (result: any) => void;
    onError: (err: any) => void;
}
/**
 * Observable task queue implementation
 * @param parallelism - how many tasks can run(wait to be finished) at the same time
 * @param throttle - how many milliseconds delay to make before running every task
 */
class TaskQueue {
    constructor(parallelism = 1, throttle = 0) {
        this.parallelism = parallelism;
        this.throttle = throttle;
    }
    parallelism: number;
    throttle: number;
    /**
     */
    paused = false;
    /**
     * List of tasks in queue. Running tasks are not here.
     */
    @observable.shallow waitingTasks = [] as IObservableArray<TaskInfo>;
    /**
     * Amount of currently running tasks
     */
    @observable runningTasks = 0;
    /**
     * Amount of currently running tasks + tasks in queue
     */
    @computed
    get length() {
        return this.waitingTasks.length + this.runningTasks;
    }

    /**
     * Adds task to the queue.
     * Depending on return value task will be considered finished right after exit from the function or
     * after returned promise is fulfilled.
     * @param task - function to run
     * @param context - 'this' context to execute the task with
     * @param args - arguments to pass to the task
     * @param onSuccess - callback will be executed as soon as task is finished without error
     * @param onError - callback will be executed if task throws or rejects promise

     */
    @action
    addTask<T = void>(
        task: (...params: any[]) => any,
        context?: {},
        args?: any[],
        onSuccess?: (result: T) => void,
        onError?: (err) => void
    ) {
        return new Promise<T>((resolve, reject) => {
            this.waitingTasks.push({
                task,
                context,
                args,
                onSuccess: result => {
                    resolve(result);
                    if (onSuccess) onSuccess(result);
                },
                onError: err => {
                    reject(err);
                    if (onError) onError(err);
                }
            });
            if (!this.paused) setTimeout(this.runTask, this.throttle);
        });
    }

    /**
     * Runs the next task in queue if it is possible
     */
    @action.bound
    runTask() {
        if (this.paused) return;
        // if reached the limit of parallel running tasks or no tasks left - doing nothing
        if (this.parallelism <= this.runningTasks || this.waitingTasks.length === 0) return;
        this.runningTasks++;
        let t;
        try {
            t = this.waitingTasks.shift();
            let ret = t.task.apply(t.context, t.args);
            if (ret instanceof Promise) {
                // task is considered done when promise is complete
                ret = ret.then(t.onSuccess);
                ret = ret.catch(t.onError);
                ret = ret.finally(this.onTaskComplete);
                return;
            }
            // otherwise we assume the task was synchronous
            if (t.onSuccess) t.onSuccess(ret);
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
     */
    @action.bound
    onTaskComplete() {
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

export default TaskQueue;
