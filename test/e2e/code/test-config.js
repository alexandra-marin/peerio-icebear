// just extracting common constants to be able to change them based on environment later

export default {
    // all our test emails will be in this domain
    emailDomain: 'test.lan',
    // all new test accounts will be created with this passphrase by default
    defaultPassphrase: 'passphrase',
    // which server to test against
    socketServerUrl: 'wss://hocuspocus.peerio.com',
    // what is the subject of confirmation email user receives when creating account
    primaryEmailConfirmSubject: 'Welcome to Peerio (Staging)! Confirm your account.',
    // what is the subject of confirmation email user receives when adding another email to profile
    newEmailConfirmSubject: 'Please confirm your new address',
    // how to find confirmation link inside confirm email body
    emailConfirmUrlRegex: /"(https:\/\/hocuspocus\.peerio\.com\/confirm-address\/.*?)"/,
    // email subject when receiving a Peerio email invitation to join from another user
    inviteEmailSubject: 'Firstname Lastname has invited you to Peerio (Staging)!',
    // email subject when receiving a MC doctor email invitation to join from a MC admin/doctor
    inviteEmailSubjectMCDoctor: 'Firstname Lastname has invited you to Medcryptor!',
    // email subject when receiving a Peerio email invitation to join from an MC user
    inviteEmailSubjectMCPatient: 'Your doctor wants to connect with you on Peerio',
    // will output every websocket message, incoming and outgoing to console
    logSocketMessages: true,
    // will output application logs to console
    showAppLogs: !!+process.env.SHOW_APP_LOGS,
    muteCucumbot: false
};
