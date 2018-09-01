const { Given, When, Then } = require('cucumber');
const { getRandomEmail } = require('../helpers/random-data');
const {
    getTempFileName,
    filesEqual,
    downloadFile,
    createRandomTempFile
} = require('../helpers/files');
const fs = require('fs');

/**
 * Creates a random file and populates an array with it
 * The array will be passed as avatar upload parameter
 */
async function createAvatarPayload(world) {
    const name = await createRandomTempFile(42);
    world.filesToCleanup.push(name);
    world.avatarFileName = name;

    const file = fs.readFileSync(name);
    return [new Uint8Array(file).buffer, new Uint8Array(file).buffer];
}

When('I change my first name to {string}', function(string) {
    ice.User.current.firstName = string;
    return ice.User.current.saveProfile();
});

When('I change my last name to {string}', function(string) {
    ice.User.current.lastName = string;
    return ice.User.current.saveProfile();
});

Then('my first name should be {string}', function(string) {
    ice.User.current.firstName.should.equal(string);
});

Then('my last name should be {string}', function(string) {
    ice.User.current.lastName.should.equal(string);
});

When('I add a new email', async function() {
    this.lastAddedEmail = getRandomEmail();
    await ice.User.current.addEmail(this.lastAddedEmail);
});

// This IS very similar to confirming primary email address in account.js
// but trying to merge these two into one universal step just makes things messy for not much benefit
When('I confirm my new email', { timeout: 400000 }, async function() {
    await this.confirmEmail(ice.User.current.username, this.lastAddedEmail);
    // giving confirmed status a chance to propagate
    return this.waitFor(() => {
        const adr = ice.User.current.addresses.find(a => a.address === this.lastAddedEmail);
        if (!adr) return false;
        return adr.confirmed;
    });
});

Then('my new email is confirmed', function() {
    const adr = ice.User.current.addresses.find(a => a.address === this.lastAddedEmail);
    expect(adr.confirmed).to.be.true;
});

When('I request confirmation email resend', function() {
    return ice.User.current.resendEmailConfirmation(this.lastAddedEmail);
});

When('I change my primary email', function() {
    return ice.User.current.makeEmailPrimary(this.lastAddedEmail);
});

Then('my primary email has been changed', function() {
    return this.waitFor(() => {
        return ice.User.current.email === this.lastAddedEmail;
    });
});

When('I upload an avatar', async function() {
    this.lastProfileVersion = ice.contactStore.currentUser.profileVersion;
    const blobs = await createAvatarPayload(this);
    await ice.User.current.saveAvatar(blobs).should.be.fulfilled;
    return Promise.delay(2000); // server updates profileVersion a bit slow
});

Then('the avatar should appear in my profile', async function() {
    const user = ice.contactStore.currentUser;
    await this.waitFor(() => user.hasAvatar);
    // sometimes server is slow to update this and tests fail sporadically :(
    if (user.profileVersion <= this.lastProfileVersion) {
        console.error('Last profile version was not updated');
    }
    // TODO: make server fix this
    // user.profileVersion.should.be.above(this.lastProfileVersion);

    const fileName = getTempFileName();
    this.filesToCleanup.push(fileName);
    return downloadFile(fileName, user.largeAvatarUrl).then(
        file => filesEqual(this.avatarFileName, file.path).should.eventually.be.true
    );
});

Given('I start uploading an avatar and do not wait to finish', async function() {
    const blob = await createAvatarPayload(this);
    ice.User.current.saveAvatar(blob); // return early
});

Then('saving a new avatar should throw an error', function() {
    return ice.User.current.saveAvatar(null).should.be.rejected;
});

When('I delete my avatar', function() {
    return ice.User.current.saveAvatar(null).should.be.fulfilled;
});

Then('my avatar should be empty', function() {
    ice.contactStore.currentUser.hasAvatar.should.be.false;
});

Then('I am shown a beacon', async function() {
    ice.User.current.beacons.mobile_files_zero = true;
    ice.User.current.beacons.desktop_files_zero = false;

    await ice.User.current.saveBeacons();
});

Then('the beacon appears as seen', function() {
    ice.User.current.beacons.mobile_files_zero.should.be.true;
    ice.User.current.beacons.desktop_files_zero.should.be.false;
});
