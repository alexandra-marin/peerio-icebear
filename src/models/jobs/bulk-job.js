const { serializeOperation, unserializeOperation } = require('./operations');

class BulkJob {
    /** @type Array<JobOperation}> */
    operations = [];
    done = false;

    constructor(operations, onDone, onSave) {
        this.operations = operations;
        this.onDone = onDone;
        this.onSave = onSave;
    }

    static unserialize(data, onSave) {
        const operations = data.map(d => unserializeOperation(d.op));
        return new BulkJob(operations, onSave);
    }

    serialize() {
        return this.operations.map(op => serializeOperation(op));
    }

    async resume() {
        const todo = this.operations.filter(op => !op.done);
        for (let i = 0; i < todo.length; i++) {
            const op = todo[i];
            await op.execute(); // eslint-disable-line no-await-in-loop
            // TODO: what to do with individual errors?
            op.done = true;
            this.onSave();
        }
        this.done = true;
        this.onSave();
        if (this.onDone) this.onDone();
    }
}

module.export = BulkJob;
