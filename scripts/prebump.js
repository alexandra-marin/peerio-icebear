const { execSync } = require('child_process');
const fs = require('fs');

// NOTE: DO NOT CONSOLE.LOG() FROM THIS FILE. standard version will interpret it as desired version number.

// here we change version number in package.json to match latest tag,
// because another branch might have been released and wasn't merged into current branch yet

// so now standard version will be bumping the correct package version

const tag = execSync('echo $(git describe --tags $(git rev-list --tags --max-count=1))').toString();
const version = tag.replace('v', '').replace('\n', '');
const pkg = JSON.parse(fs.readFileSync('./package.json'));
pkg.version = version;
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
