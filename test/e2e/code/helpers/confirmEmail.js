const { waitForEmail } = require('./maildrop');
const testConfig = require('../test-config');
const { getUrl } = require('./https');

async function confirmPrimaryEmail(emailAddress) {
    const email = await waitForEmail(emailAddress, testConfig.primaryEmailConfirmSubject);
    const url = testConfig.emailConfirmUrlRegex.exec(email.body)[1];
    await getUrl(url);
}

module.exports = confirmPrimaryEmail;
