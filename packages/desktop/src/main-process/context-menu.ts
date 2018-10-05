import { Menu, globalShortcut } from 'electron';
import * as devtools from '~/main-process/dev-tools';
import isDevEnv from '~/helpers/is-dev-env';

const rightClickPos = { x: 0, y: 0 };

const inputMenu = Menu.buildFromTemplate([
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    { role: 'selectall' }
]);

const menu = new Menu();

Menu.buildFromTemplate([
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' }
]).items.forEach(i => menu.append(i));

let devToolsMenuCreated = false;

export default function buildContextMenu(mainWindow) {
    console.log('Building context menu.');
    if (isDevEnv) {
        devtools.extendContextMenu(menu, mainWindow, rightClickPos);
    } else {
        globalShortcut.register('CommandOrControl+Alt+P+O', () => {
            if (devToolsMenuCreated) return;
            devtools.extendContextMenu(menu, mainWindow, rightClickPos);
            mainWindow.webContents.send('activate_dev_mode');
            devToolsMenuCreated = true;
        });
    }

    mainWindow.webContents.on('context-menu', (_e, props) => {
        rightClickPos.x = props.x;
        rightClickPos.y = props.y;
        const { isEditable } = props;
        if (isEditable) {
            inputMenu.popup(mainWindow);
        } else {
            menu.popup(mainWindow);
        }
    });
}
