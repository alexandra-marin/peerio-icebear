const { defineSupportCode } = require('cucumber');
const { createRandomTempFile, getTempFileName, filesEqual } = require('../helpers/files');

defineSupportCode(({ When, Then }) => {
    When('I upload a {int} byte file', { timeout: 100000 }, async function(int) {
        const name = await createRandomTempFile(int);
        this.filesToCleanup.push(name);
        const keg = this.ice.fileStore.upload(name);
        await this.waitForObservable(() => !keg.uploading && keg.readyForDownload, 100000);
        this.uploadedFile = { name, fileId: keg.fileId };
    });

    Then('I see the uploaded file in my drive', function() {
        const keg = this.ice.fileStore.getById(this.uploadedFile.fileId);
        keg.fileId.should.equal(this.uploadedFile.fileId);
    });

    When('I download the uploaded file', { timeout: 100000 }, async function() { // eslint-disable-line
        const name = getTempFileName();
        this.downloadedFile = { name, fileId: this.uploadedFile.fileId };
        return this.ice.fileStore.getById(this.uploadedFile.fileId).download(name).then(() => {
            this.filesToCleanup.push(name);
        });
    });

    Then('the uploaded and the downloaded files are the same', async function() {  // eslint-disable-line
        const same = await filesEqual(this.uploadedFile.name, this.downloadedFile.name);
        same.should.be.true;
    });
});

