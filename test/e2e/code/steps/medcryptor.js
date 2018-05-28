const { Given, Then } = require('cucumber');

Given('I create a MedCryptor account', { timeout: 60000 }, async function() {
    this.ice.config.appLabel = 'medcryptor';
    this.ice.config.platform = 'ios';
    await this.createAccount();
});

Given('I create a MedCryptor account with metadata', { timeout: 60000 }, async function() {
    this.ice.config.appLabel = 'medcryptor';
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


Then('I can assign space properties to rooms', async function() {
    const space = {
        spaceId: null,
        spaceName: 'Patient Space 1',
        spaceDescription: 'Discuss the case with docs and patient'
    };

    space.spaceRoomType = 'internal';
    const internalRoom = await ice.chatStore.startChat([], true, 'test-internal', 'test', null, space);
    await this.waitFor(() => internalRoom.metaLoaded && ice.chatStore.activeChat);

    space.spaceRoomType = 'patient';
    const patientRoom = await ice.chatStore.startChat([], true, 'test-patient', 'test', null, space);
    await this.waitFor(() => patientRoom.metaLoaded && ice.chatStore.activeChat);

    ice.chatStore.spaces.length.should.equal(1);

    const returnedSpace = ice.chatStore.spaces[0];
    
    returnedSpace.spaceName.should.equal(space.spaceName);
    returnedSpace.spaceDescription.should.equal(space.spaceDescription);

    returnedSpace.internalRooms.length.should.equal(1);
    returnedSpace.internalRooms[0].should.deep.equal(internalRoom);

    returnedSpace.patientRooms.length.should.equal(1);
    returnedSpace.patientRooms[0].should.deep.equal(patientRoom);
});

Then('I can invite Cucumbot to a room with a space', async function() {

});

Then('I can list patient spaces', async function() {

});

