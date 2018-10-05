//
// WARNING:
// This module is being loaded in prod env too, make sure devDependencies are not getting required in prod env
//
import path from 'path';
import { MenuItem, Menu, BrowserWindow } from 'electron';
import * as appControl from '~/helpers/app-control';
import isDevEnv from '~/helpers/is-dev-env';

const appRootPath = path.resolve(`${__dirname}/`); // build
const repoRootPath = path.resolve(`${__dirname}/../../`);
// restart electron when files changed in dev mode
if (isDevEnv) {
    const PATH_APP_NODE_MODULES = path.join(repoRootPath, 'node_modules');
    require('module').globalPaths.push(PATH_APP_NODE_MODULES);
    const watchPaths = [
        appRootPath,
        path.join(PATH_APP_NODE_MODULES, 'peerio-icebear', 'dist')
    ];
    console.log('electron-reload watching:', watchPaths);
    require('electron-reload')(watchPaths, {
        electron: path.join(repoRootPath, 'node_modules', '.bin', 'electron'),
        ignored: false
    });
}

export function onAppReady(mainWindow: BrowserWindow): void {
    if (!isDevEnv) return;
    if (process.env.REMOTE_DEBUG_PORT === undefined) {
        mainWindow.webContents.openDevTools();
    }
}

export function installExtensions(): Promise<void> {
    if (!isDevEnv) return Promise.resolve();
    console.log('installing extensions.');
    const devtron = require('devtron');
    devtron.install();

    const {
        default: install,
        REACT_DEVELOPER_TOOLS,
        REACT_PERF,
        MOBX_DEVTOOLS
    } = require('electron-devtools-installer');

    return install([REACT_DEVELOPER_TOOLS, REACT_PERF, MOBX_DEVTOOLS])
        .then(name => console.log(`Added Extension:  ${name}`))
        .catch(err => console.log('An error occurred: ', err));
}

export function extendContextMenu(
    menu: Menu,
    mainWindow: BrowserWindow,
    rightClickPos: { x: number; y: number }
): void {
    console.log('Extending context menu with dev tools.');
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(
        new MenuItem({
            label: 'Restart',
            click() {
                appControl.relaunch();
            }
        })
    );
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(
        new MenuItem({
            label: '🔧 Dev tools',
            click() {
                mainWindow.webContents.send('router', '/dev-tools');
            }
        })
    );
    menu.append(
        new MenuItem({
            label: '🔃 Reload page',
            accelerator: 'CommandOrControl+R',
            role: 'reload',
            click() {
                mainWindow.reload();
            }
        })
    );
    menu.append(
        new MenuItem({
            label: '☝️ Inspect Element',
            click() {
                mainWindow.webContents.inspectElement(
                    rightClickPos.x,
                    rightClickPos.y
                );
            }
        })
    );
}
