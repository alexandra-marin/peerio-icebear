const { observable } = require('mobx');
const _ = require('lodash');
const TaskQueue = require('../../helpers/task-queue');
const TinyDb = require('../../db/tiny-db');
const BulkJob = require('./bulk-job');

const TINYDB_KEY = 'bulk_jobs';

class BulkJobStore {
    @observable loaded = false;
    jobs = [];
    queue = new TaskQueue();

    async load() {
        try {
            const jobsData = await TinyDb.user.getValue(TINYDB_KEY);
            if (jobsData) {
                this.jobs = this.jobsData.map(data => BulkJob.unserialize(data, this.save));
            }
        } catch (err) {
            console.error('Failed to unserialize jobs data to resume', err);
        }
        this.loaded = true;
    }

    async saveImmediately() {
        this.jobs = this.jobs.filter(job => !job.done);
        await TinyDb.user.setValue(TINYDB_KEY, this.jobs.map(job => job.serialize()));
    }

    save = _.throttle(() => {
        return this.saveImmediately();
    }, 2000);


    /**
     * Creates a new job from operations and adds it to queue for executing.
     *
     * Example:
     *
     *  bulkJobStore.createJob([
     *      new RemoveFileOperation({ fileId: 123 }),
     *      new RenameFileOpration({ ... })
     *  ])
     *
     * @param {Array<JobOperation>} operations
     */
    createJob(operations, onDone) {
        const job = new BulkJob(operations, onDone, this.save);
        this.jobs.push(job);
        this.queue.addTask(job.resume, job);
        this.save();
    }

    resume() {
        this.queue.resume();
    }

    pause() {
        // XXX: this pauses whole jobs, but operations within
        // a single job will continue to proceed.
        this.queue.pause();
    }
}

module.exports = new BulkJobStore();
