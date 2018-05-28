const { Given, Then } = require('cucumber');

Given('I create a MedCryptor account', { timeout: 60000 }, async function() {
    this.ice.config.appLabel = 'medcryptor';
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

});

Then('I can invite Cucumbot to a room with a space', async function() {

});

Then('I can list patient spaces', async function() {

});

