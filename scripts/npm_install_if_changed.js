const fs = require('fs');
const { execSync } = require('child_process');

try {
    let existing;
    try {
        existing = fs.readFileSync('.package.json.md5');
    } catch (ex) {
        // don't care
    }
    const actual = execSync(process.platform === 'darwin' ? 'md5 -q package.json' : 'md5sum package.json');
    if (existing.toString() !== actual.toString()) {
        console.log('package.json has changed, running npm install.');
        execSync('npm install');
    } else {
        console.log('package.json has not changed, skipping npm install.');
    }
} catch (ex) {
    console.error(ex);
}
