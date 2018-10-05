#!/usr/bin/env node

const path = require('path');
const fse = require('fs-extra');
const globalRequire = require('require-global-node-module');
const chokidar = require('chokidar');
const debounce = require('debounce-queue');

const doWatch = process.argv[2] === '-w';

const cwd = process.cwd();
const moduleName = 'peerio-icebear';
let initialCopyDone = false;

const modulePath = globalRequire.resolve(moduleName);
console.log('Source: ', modulePath);
const watcher = chokidar.watch(
    [path.join(modulePath, 'src'), path.join(modulePath, 'package.json')],
    { cwd: modulePath }
);

const copy = debounce(
    _ =>
        _.forEach(filePath => {
            const fullFilePath = path.join(modulePath, filePath);
            // const filePath = path.relative(modulePath, fullFilePath);
            const fullDestPath = path.join(
                cwd,
                'node_modules',
                moduleName,
                filePath
            );
            fse.copy(fullFilePath, fullDestPath, error => {
                if (error) {
                    console.error('Cannot copy', filePath, error.message);
                } else if (initialCopyDone) {
                    console.log(fullFilePath, '=>', fullDestPath);
                }
            });
        }),
    500
);

if (!doWatch) watcher.on('add', copy);
watcher.on(
    'ready',
    debounce(() => {
        if (doWatch) {
            initialCopyDone = true;
            watcher.removeListener('add', copy);
            console.log('Starting icebear link watcher');
            watcher.on('change', copy);
        } else {
            console.log('Icebear copied.');
            watcher.close();
        }
    }, 1000)
);
