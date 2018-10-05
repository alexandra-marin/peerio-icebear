const { app, Menu } = require('electron');
const config = require('~/config');
const isDevEnv = require('~/helpers/is-dev-env').default;

const editMenu = {
    label: 'Edit',
    submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        // { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
    ]
};

const viewMenu = {
    label: 'View',
    submenu: [{ role: 'reload' }, { role: 'toggledevtools' }]
};

const windowMenu = {
    role: 'window',
    submenu: [{ role: 'minimize' }, { role: 'close' }]
};

const helpMenu = {
    role: 'help',
    submenu: [
        {
            label: 'Support', // don't use https: url due to weird redirect issues
            click() {
                require('electron').shell.openExternal(
                    config.translator.urlMap.helpCenter
                );
            }
        }
    ]
};

const template = [editMenu];

if (isDevEnv) {
    template.push(viewMenu);
}

template.push(windowMenu, helpMenu);

if (process.platform === 'darwin') {
    template.unshift({
        label: app.getName(),
        submenu: [
            { role: 'about' },
            { type: 'separator' },
            {
                role: 'services',
                submenu: []
            },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
        ]
    });
    // Edit menu.
    editMenu.submenu.push(
        {
            type: 'separator'
        },
        {
            label: 'Speech',
            submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }]
        }
    );
    // Window menu.
    windowMenu.submenu = [
        {
            label: 'Close',
            accelerator: 'CmdOrCtrl+W',
            role: 'close'
        },
        {
            label: 'Minimize',
            accelerator: 'CmdOrCtrl+M',
            role: 'minimize'
        },
        {
            label: 'Zoom',
            role: 'zoom'
        },
        {
            type: 'separator'
        },
        // NOTE: if we support multiple accounts in one window,
        // this can be removed in favour of account switcher
        // that will trigger on Cmd+1, Cmd+2, etc.
        {
            label: 'Main Window',
            accelerator: 'CmdOrCtrl+0',
            click() {
                app.emit('activate');
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Bring All to Front',
            role: 'front'
        }
    ];
}

function setMainMenu() {
    if (process.platform !== 'darwin') return;
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

module.exports = setMainMenu;
