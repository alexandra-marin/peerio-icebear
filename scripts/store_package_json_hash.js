if (process.env.CI) return;

const { execSync } = require('child_process');

console.log('Storing package.json hash');
if (process.platform === 'darwin') {
    console.log('Using md5 command under osx.');
    execSync('md5 -q package.json > .package.json.md5');
} else {
    console.log('Using md5sum command under linux.');
    execSync('md5sum package.json > .package.json.md5');
}
