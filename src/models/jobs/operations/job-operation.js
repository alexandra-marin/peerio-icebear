/**
 * JobOperation is a base class for job task operations.
 */
class JobOperation {
    /* registered subclasses will also contain:
     * __opname = '';
     */

    constructor(props) {
        this.props = props;
        this.done = false; /** managed by LocalJob */
    }

    /**
     * Execute operation on this.props.
     */
    async execute() {
        throw new Error('JobOperation execute() method is not implemented')
    }
}

module.exports = JobOperation;
