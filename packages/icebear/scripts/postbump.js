const { execSync } = require('child_process');
const fs = require('fs');

const sdkFilePath = './src/__sdk.ts';
// This will not be needed after we start shipping icebear with compiled sources
const pkg = JSON.parse(fs.readFileSync('./package.json'));
fs.writeFileSync(sdkFilePath, `export default '${pkg.version}';\n`);
execSync(`git add ${sdkFilePath}`);
