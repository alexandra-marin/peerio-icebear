const { When, Then } = require('cucumber');
const { createRandomTempFile, getTempFileName, filesEqual } = require('../helpers/files');
const { startDmWithCucumbot } = require('./dm.helpers');

When('I upload a {int} byte file', { timeout: 100000 }, async function(int) {
    const name = await createRandomTempFile(int);
    this.filesToCleanup.push(name);
    const keg = ice.fileStore.upload(name);
    await this.waitFor(() => !keg.uploading && keg.readyForDownload, 100000);
    this.uploadedFile = { name, fileId: keg.fileId };
});

When('I rename uploaded file to {string}', async function(string) {
    this.filesToCleanup.push(string);
    await ice.fileStore.getById(this.uploadedFile.fileId).rename(string);
});

function hasFileNamed(string) {
    return this.waitFor(() => !!ice.fileStore.files.find(f => f.name === string));
}

Then('I have a file named {string}', hasFileNamed);

Then('Cucumbot has a file named {string}', hasFileNamed);

When('I remove the uploaded file', function() {
    return ice.fileStore.getById(this.uploadedFile.fileId).remove();
});

function hasXFiles(int) {
    return this.waitFor(() => ice.fileStore.files.length === int);
}
Then('I have {int} files', hasXFiles);
Then('Cucumbot has {int} files', hasXFiles);

Then('I see the uploaded file in my drive', function() {
    const keg = ice.fileStore.getById(this.uploadedFile.fileId);
    keg.fileId.should.equal(this.uploadedFile.fileId);
});

When('I download the uploaded file', { timeout: 100000 }, function() {
    const name = getTempFileName();
    this.downloadedFile = { name, fileId: this.uploadedFile.fileId };
    return ice.fileStore.getById(this.uploadedFile.fileId).download(name).then(() => {
        this.filesToCleanup.push(name);
    });
});

Then('the uploaded and the downloaded files are the same', async function() {
    const same = await filesEqual(this.uploadedFile.name, this.downloadedFile.name);
    same.should.be.true;
});

When('I share the uploaded file with Cucumbot', async function() {
    await startDmWithCucumbot.call(this);
    const file = ice.fileStore.getById(this.uploadedFile.fileId);
    const contact = ice.contactStore.getContact(this.cucumbotClient.username);
    await contact.ensureLoaded();
    return ice.chatStore.activeChat.shareFiles([file]);
});

async function checkIfUploadedFileIsShared() {
    const file = ice.fileStore.getByIdInChat(this.uploadedFile.fileId, ice.chatStore.activeChat.id);
    await file.ensureLoaded();
    expect(file.deleted).to.be.not.true;
    await this.waitFor(() => ice.chatStore.activeChat);
    const messages = ice.chatStore.activeChat.messages;
    await this.waitFor(() => messages.length === 2);
    messages[1].files.should.deep.equal([this.uploadedFile.fileId]);
}

Then('The uploaded file is shared with Cucumbot', { timeout: 40000 }, async function() {
    await checkIfUploadedFileIsShared.call(this);
    this.cucumbotClient.remoteEval(`this.world.uploadedFile={fileId:'${this.uploadedFile.fileId}'}`);
});

Then('Cucumbot received the uploaded file in DM', { timeout: 40000 }, function() {
    return checkIfUploadedFileIsShared.call(this);
});

Then('Cucumbot can download the received file in DM', function() {
    const name = getTempFileName();
    return ice.fileStore.getByIdInChat(this.uploadedFile.fileId, ice.chatStore.activeChat.id)
        .download(name).then(() => {
            this.filesToCleanup.push(name);
        });
});
