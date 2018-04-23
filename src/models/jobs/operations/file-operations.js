const JobOperation = require('./job-operation');
const { getFileStore } = require('../../../helpers/di-file-store');

/**
 * Removes file.
 *
 * Props: {
 *  fileId
 * }
 */
class RemoveFileOperation extends JobOperation {
    async execute() {
        const { fileId } = this.props;
        console.log(`Remove file operation: fileId=${fileId}`);
        return getFileStore().getById(fileId).remove();
    }
}

module.exports = {
    RemoveFileOperation
};
