const { getRandomEmail } = require('../helpers/random-data');

class ContactsHelper {
    constructor(world) {
        this.world = world;
    }

    findContact = async query => {
        const contact = this.world.ice.contactStore.getContact(query);
        await this.world.waitFor(() => contact.loading === false);
        contact.notFound.should.be.false;
        return contact;
    };

    inviteRandomEmail = async () => {
        this.world.invitedEmail = getRandomEmail();
        await this.world.ice.contactStore.invite(this.world.invitedEmail);
    };

    inviteRandomEmailWithTemplate = async template => {
        this.world.invitedEmail = getRandomEmail();
        await this.world.ice.contactStore.invite(
            this.world.invitedEmail,
            template
        );
    };
}

module.exports = ContactsHelper;
