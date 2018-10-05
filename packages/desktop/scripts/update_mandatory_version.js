/**
 * Sets 'lastMandatoryUpdateVersion' in package.json to the same value as 'version'.
 */
const path = require('path');
const fs = require('fs');

const packageFilename = path.join(__dirname, '..', 'package.json');
const data = require(packageFilename);
data.lastMandatoryUpdateVersion = data.version;
fs.writeFileSync(packageFilename, JSON.stringify(data, null, 2) + '\n');
console.log(
    `Mandatory update version set to ${data.lastMandatoryUpdateVersion}`
);
