const config = require('~/config');

let PatientList = require('~/ui/chat/components/PatientList');

if (config.whiteLabel.name === 'medcryptor') {
    PatientList = require('~/ui/chat/components/PatientList_medcryptor');
}

module.exports = PatientList;
