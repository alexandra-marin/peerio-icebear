const { When, Then } = require('cucumber');
const { createRandomTempFile, getTempFileName, filesEqual } = require('../helpers/files');
const { startDmWithCucumbot } = require('./dm.helpers');

When('I upload a {int} byte file', async function(int) {
    const name = await createRandomTempFile(int);
    this.filesToCleanup.push(name);
    const keg = ice.fileStore.upload(name);
    await this.waitFor(() => !keg.uploading && keg.readyForDownload);
    this.uploadedFile = { name, fileId: keg.fileId };
});

When('I rename uploaded file to {string}', async function(string) {
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
Then('I have {int} files in my drive', hasXFiles);
Then('Cucumbot has {int} files in his drive', hasXFiles);

async function fileExistInDrive() {
    let keg;
    await this.waitFor(() => {
        keg = ice.fileStore.getById(this.uploadedFile.fileId);
        return keg;
    });
    keg.fileId.should.equal(this.uploadedFile.fileId);
}

Then('I see the uploaded file in my drive', fileExistInDrive);

Then('Cucumbot can see the uploaded file in his drive', fileExistInDrive);

Then('Cucumbot can not see the uploaded file in the room', async function() {
    return this.waitFor(() =>
        ice.fileStore.getByIdInChat(this.uploadedFile.fileId, ice.chatStore.channels[0].id).deleted
    );
});

Then('Cucumbot can not see the uploaded file in DM', async function() {
    return this.waitFor(() =>
        ice.fileStore.getByIdInChat(this.uploadedFile.fileId, ice.chatStore.directMessages[0].id).deleted
    );
});

When('I download the uploaded file', function() {
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
    return ice.chatStore.directMessages[0].shareFiles([file]);
});

When('I unshare the uploaded file with Cucumbot', async function() {
    return ice.chatStore.directMessages[0].unshareFile(this.uploadedFile.fileId);
});

When('I unshare the uploaded file with the room', async function() {
    return ice.chatStore.channels[0].unshareFile(this.uploadedFile.fileId);
});

When('I share the uploaded file in the room', async function() {
    const file = ice.fileStore.getById(this.uploadedFile.fileId);
    return ice.chatStore.channels[0].shareFiles([file]);
});

async function checkFileIsShared(chat) {
    await this.waitFor(() => chat.metaLoaded);
    const file = ice.fileStore.getByIdInChat(this.uploadedFile.fileId, chat.id);
    await file.ensureLoaded();
    expect(file.deleted).to.be.not.true;
    const messages = chat.messages;
    await this.waitFor(() => messages.length === (chat.isChannel ? 4 : 2));
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.files).deep.equal([this.uploadedFile.fileId]);
}

Then('Cucumbot can see the uploaded file in DM', async function() {
    const chat = ice.chatStore.directMessages[0];
    await chat._messageHandler.getInitialPage(); // might not be active in multi-chat test after restart
    return checkFileIsShared.call(this, chat);
});
Then('Cucumbot can see the uploaded file in the room', async function() {
    const chat = ice.chatStore.channels[0];
    await chat._messageHandler.getInitialPage();// might not be active in multi-chat test after restart
    return checkFileIsShared.call(this, chat);
});

async function checkIfUploadedFileIsShared(chat) {
    this.cucumbotClient.remoteEval(`this.world.uploadedFile={fileId:'${this.uploadedFile.fileId}'}`);
    await checkFileIsShared.call(this, chat);
}
Then('The uploaded file is shared with Cucumbot', function() {
    const chat = ice.chatStore.directMessages[0];
    return checkIfUploadedFileIsShared.call(this, chat);
});
Then('The uploaded file is shared in the room', function() {
    const chat = ice.chatStore.channels[0];
    return checkIfUploadedFileIsShared.call(this, chat);
});


function cucumbotDownload(chatId) {
    const name = getTempFileName();
    return ice.fileStore.getByIdInChat(this.uploadedFile.fileId, chatId)
        .download(name).then(() => {
            this.filesToCleanup.push(name);
        });
}
Then('Cucumbot can download the received file in DM', function() {
    return cucumbotDownload.call(this, ice.chatStore.directMessages[0].id);
});
Then('Cucumbot can download the received file in the room', function() {
    return cucumbotDownload.call(this, ice.chatStore.channels[0].id);
});

Then('Cucumbot can not download the uploaded file', function() {
    return ice.socket.send('/auth/file/url', { fileId: this.uploadedFile.fileId })
        .timeout(5000)
        .then(resp => {
            console.log('resolved', resp);
        }).catch(err => {
            console.log('rejected', err);
        });
});
async function fileRemoved(chat) {
    await this.waitFor(() => chat.metaLoaded);
    const file = ice.fileStore.getByIdInChat(this.uploadedFile.fileId, chat.id);
    return this.waitFor(() => file.deleted);
}

Then('The uploaded file is removed from the DM', function() {
    const chat = ice.chatStore.directMessages[0];
    return fileRemoved.call(this, chat);
});
Then('The uploaded file is removed from the room', function() {
    const chat = ice.chatStore.channels[0];
    return fileRemoved.call(this, chat);
});
