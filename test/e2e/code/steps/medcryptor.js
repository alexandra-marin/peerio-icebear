const { Given, Then } = require('cucumber');

Given('I create a MedCryptor account', { timeout: 60000 }, async function() {
    this.ice.config.whiteLabel.name = 'medcryptor';
    this.ice.config.platform = 'ios';
    await this.createAccount();
    if (this.cucumbotClient) this.cucumbotClient.sendReady();
});

Given('I create a MedCryptor account with metadata', { timeout: 60000 }, async function() {
    this.ice.config.whiteLabel.name = 'medcryptor';
    this.ice.config.platform = 'ios';
    const medcryptorData = {
        specialization: 'cardiology',
        medicalID: '001',
        country: 'Canada',
        role: 'doctor'
    };

    await this.createMedcryptorAccount(medcryptorData);
    await this.app.restart();
    await this.login();

    this.ice.User.current.props.should.deep.equal(medcryptorData);
});

Then('I can edit specialization, medical ID, country and role', async function() {
    const medcryptorData = {
        specialization: 'admin',
        medicalID: '002',
        country: 'Australia',
        role: 'admin'
    };

    this.ice.User.current.props = medcryptorData;
    await this.ice.User.current.saveProfile();

    await this.app.restart();
    await this.login();

    this.ice.User.current.props.should.deep.equal(medcryptorData);
});

Then('I create a patient space', async function() {
    this.space = {
        spaceId: null,
        spaceName: 'Patient Space 1',
        spaceDescription: 'Discuss the case with docs and patient',
        nameInSpace: 'general'
    };
});

Then('I create two internal rooms', async function() {
    this.space.spaceRoomType = 'internal';
    this.internalRoom1 = await ice.chatStore.startChat([], true, 'test-internal1', 'test', null, this.space);
    await this.waitFor(() => this.internalRoom1.metaLoaded && ice.chatStore.activeChat);

    this.internalRoom2 = await ice.chatStore.startChat([], true, 'test-internal2', 'test', null, this.space);
    await this.waitFor(() => this.internalRoom2.metaLoaded && ice.chatStore.activeChat);
});

Then('I create a patient room', async function() {
    this.space.spaceRoomType = 'patient';
    this.patientRoom = await ice.chatStore.startChat([], true, 'test-patient', 'test', null, this.space);
    await this.waitFor(() => this.patientRoom.metaLoaded && ice.chatStore.activeChat);
});

Then('I can view the patient space', async function() {
    ice.chatStore.spaces.length.should.equal(1);

    const returnedSpace = ice.chatStore.spaces[0];

    returnedSpace.spaceName.should.equal(this.space.spaceName);
    returnedSpace.spaceDescription.should.equal(this.space.spaceDescription);
    returnedSpace.isNew.should.equal(false);
    returnedSpace.unreadCount.should.equal(0);

    returnedSpace.internalRooms.length.should.equal(2);
    returnedSpace.internalRooms.should.deep.equal([this.internalRoom1, this.internalRoom2]);

    returnedSpace.patientRooms.length.should.equal(1);
    returnedSpace.patientRooms.should.deep.equal([this.patientRoom]);
});

Then('I get notified of unread messages', async function() {
    const allUnread = this.internalRoom1.unreadCount +
        this.internalRoom2.unreadCount +
        this.patientRoom.unreadCount;
    
    const returnedSpace = ice.chatStore.spaces[0];
    returnedSpace.unreadCount.should.equal(allUnread);
});

Then('I create another patient space', async function() {
    this.anotherSpace = {
        spaceId: null,
        spaceName: 'Patient Space 2',
        spaceDescription: 'Discuss case #2 with docs and patient',
        spaceRoomType: 'patient',
        nameInSpace: 'general'
    };
    const room = await ice.chatStore.startChat([], true, 'test-space-2', 'test', null, this.anotherSpace);
    await this.waitFor(() => room.metaLoaded && ice.chatStore.activeChat);

    ice.chatStore.spaces.length.should.equal(2);
    ice.chatStore.spaces[0].spaceName.should.equal(this.space.spaceName);
    ice.chatStore.spaces[1].spaceName.should.equal(this.anotherSpace.spaceName);
});
