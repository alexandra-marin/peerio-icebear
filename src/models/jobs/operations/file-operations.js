const JobOperation = require('./job-operation');
const { getFileStore } = require('../../helpers/di-file-store');

class RemoveFileOperation extends JobOperation {
    async execute() {
        const { fileId } = this.props;
        console.log(`Remove file operation: fileId=${fileId}`);
        return await getFileStore().getById(fileId).remove();
    }
}

module.exports = {
    RemoveFileOperation
};
