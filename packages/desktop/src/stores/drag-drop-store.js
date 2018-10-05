const { observable, action, autorun } = require('mobx');
const { User } = require('peerio-icebear');
const routerStore = require('~/stores/router-store');
const { getFileTree, getFileList } = require('~/helpers/file');
const _ = require('lodash');

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// There's currently a bug in electron that has broken the normal flow of this store
// https://github.com/electron/electron/issues/9840
// Some features have been disabled here and in DropTarget.jsx
// until it's fixed
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
class DragDropStore {
    @observable preparingForUpload = false;
    @observable hovering = false;
    @observable hoveringFileCount = 0;
    @observable hoveringFileSize = 0;
    _counter = 0;
    _subscribers = [];
    _hoveringFiles = null;

    _extractPath(dropFile) {
        return dropFile.path;
    }
    @action.bound
    _onEnter(ev) {
        // console.log('enter', this._counter, ev.dataTransfer.files.length);
        ev.preventDefault();

        // if (!User.current || !ev.dataTransfer.files.length) return;
        // restore this line ^ after bug is fixed in electron
        if (
            !User.current ||
            !ev.dataTransfer.items.length ||
            Array.prototype.slice
                .call(ev.dataTransfer.items)
                .filter(it => it.kind === 'file').length === 0
        ) {
            return;
        }
        // remove this condition ^ after electron bug is fixed
        this._counter++;
        if (this._counter === 1) {
            // let list = Array.prototype.slice.call(ev.dataTransfer.files);
            // list = list.map(this._extractPath).map(getFileTree);  // TODO: getFileTree is now async
            // console.debug(`Hovering ${list.success.length} files of ${list.successBytes} bytes`);
            this.hovering = true;
            // this.hoveringFileCount = list.success.length;
            // this.hoveringFileSize = list.successBytes;
            // this._hoveringFiles = list;
        }
    }

    _onLeave = ev => {
        //  console.log('leave', this._counter, ev.dataTransfer.files.length);
        ev.preventDefault();
        if (this._counter > 0) this._counter--;
        if (this._counter === 0) {
            this.hovering = false;
            this.hoveringFileCount = 0;
            this.hoveringFileSize = 0;
        }
    };

    _onDrop = async ev => {
        // console.log('drop', this._counter, ev.dataTransfer.files.length);
        ev.preventDefault();
        if (!User.current) return;
        this._counter = 0;
        this.hovering = false;
        this.hoveringFileCount = 0;
        this.hoveringFileSize = 0;
        this.preparingForUpload = true;
        try {
            if (this._subscribers.length) {
                const paths = Array.prototype.slice
                    .call(ev.dataTransfer.files)
                    .map(this._extractPath);
                const list = await getFileList(paths);
                const trees = [];
                for (let i = 0; i < paths.length; i++) {
                    trees.push(await getFileTree(paths[i]));
                }
                _.remove(trees, item => !item);
                this._subscribers.forEach(handler => {
                    handler(list, trees);
                });
            }
        } finally {
            this.preparingForUpload = false;
        }
    };

    _onOver = ev => {
        // console.log('over', this._counter, ev.dataTransfer.files.length);
        ev.preventDefault();
        // if (!User.current || !ev.dataTransfer.files.length) {
        // restore this line ^ after electron bug is fixed
        if (
            !User.current ||
            !ev.dataTransfer.items.length ||
            Array.prototype.slice
                .call(ev.dataTransfer.items)
                .filter(it => it.kind === 'file').length === 0
        ) {
            // remove these two lines ^ after electron bug is fixed
            ev.dataTransfer.dropEffect = 'none';
            ev.dataTransfer.effectAllowed = 'none';
        } else {
            ev.dataTransfer.dropEffect = 'copy';
            ev.dataTransfer.effectAllowed = 'copy';
        }
    };

    /**
     * Subscribe handler to files dropped event
     * @param {Function<Array<string>>} handler
     */
    onFilesDropped(handler) {
        if (!this._subscribers.includes(handler))
            this._subscribers.push(handler);
    }
}

const store = new DragDropStore();

// HACK: since this class interacts with the dom, it should really be in a
// component (probably DropTarget since it's the only component that currently
// uses it) and hook into its lifecycle events. instead, we've gotta pull in the
// router and examine the current route to decide if we should be enabled...
autorun(() => {
    if (routerStore.currentRoute === routerStore.ROUTES.files) {
        window.removeEventListener('drop', store._onDrop, false);
        window.removeEventListener('dragenter', store._onEnter, false);
        window.removeEventListener('dragleave', store._onLeave, false);
        window.removeEventListener('dragover', store._onOver, false);
    } else {
        window.addEventListener('drop', store._onDrop, false);
        window.addEventListener('dragenter', store._onEnter, false);
        window.addEventListener('dragleave', store._onLeave, false);
        window.addEventListener('dragover', store._onOver, false);
    }
});

module.exports = store;
