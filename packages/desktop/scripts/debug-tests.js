#!/usr/bin/env node
/* eslint-disable */
const cp = require('child_process');
let gotUrl = false;

function runCmd(cmd, args, callback) {
    const child = cp.spawn(cmd, args || []);
    if (callback) {
        child.stdout.on('data', buffer => {
            callback(buffer.toString());
        });
        child.stderr.on('data', buffer => {
            callback(buffer.toString());
        });
        // child.stdout.on('end', () => { callback(); });
    }
}

function processMochaOutput(str) {
    if (!gotUrl) {
        const match = /chrome-devtools:\S*/m.exec(str);
        if (match && match.length) {
            gotUrl = true;
            openChrome(match[0]);
        }
    }
    if (str != null) console.log(str);
}

function openChrome(url) {
    let cmd =
        'osascript <<EOD\n\
   set theURL to "' +
        url +
        '"\n\
    tell application "Google Chrome"\n\
        if windows = {} then\n\
            make new window\n\
            set URL of (active tab of window 1) to theURL\n\
        else\n\
            make new tab at the end of window 1 with properties {URL:theURL}\n\
        end if\n\
        activate\n\
    end tell\n\
EOD';

    cp.exec(cmd, (err, stdout, stderr) => {
        err && console.error(err);
        stdout && console.log(stdout);
        stderr && console.log(stderr);
    });
}
process.env.DEBUG = true;
runCmd('mocha', ['--inspect', '--debug-brk'], processMochaOutput, {
    env: process.env
});
