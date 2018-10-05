const React = require('react');
const { observer } = require('mobx-react');
const Croppie = require('croppie');
const { observable } = require('mobx');
const { Button } = require('peer-ui');
const electron = require('electron').remote;
const { t } = require('peerio-translator');

@observer
class AvatarEditor extends React.Component {
    @observable
    static state = {
        showEditor: false,
        selectedFile: null
    };

    static selectFile = () => {
        const win = electron.getCurrentWindow();
        electron.dialog.showOpenDialog(
            win,
            {
                properties: ['openFile'],
                filters: [
                    {
                        name: t('title_images'),
                        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp']
                    }
                ]
            },
            files => {
                if (!files || !files.length) return;
                AvatarEditor.state.selectedFile = files[0];
                AvatarEditor.state.showEditor = true;
            }
        );
    };

    static close = () => {
        AvatarEditor.state.showEditor = false;
    };

    static closeAndReturnBuffers = blobs => {
        AvatarEditor.close();
        return new Promise(resolve => {
            const buffers = [];
            let c = 0;
            const reader = new FileReader();
            reader.onload = function() {
                buffers.push(reader.result);
                if (c === 1) {
                    resolve(buffers);
                    return;
                }
                c++;
                reader.readAsArrayBuffer(blobs[c]);
            };
            reader.readAsArrayBuffer(blobs[c]);
        });
    };

    initCroppie = el => {
        if (!el) {
            if (this.croppie) this.croppie.destroy();
            return;
        }
        this.croppie = new Croppie(el, {
            url: AvatarEditor.state.selectedFile,
            boundary: { width: 420, height: 420 },
            viewport: { width: 224, height: 224, type: 'square' },
            enableOrientation: true
        });
    };

    rotateLeft = () => {
        this.croppie.rotate(-90);
    };

    rotateRight = () => {
        this.croppie.rotate(90);
    };

    handleSave = () => {
        // 224x224
        // 64x64
        // 40x40
        // 20x20
        const opts = {
            type: 'blob',
            size: { width: 224, height: 224 },
            format: 'png',
            quality: 1,
            circle: false
        };
        const blobs = [];
        this.croppie
            .result(opts)
            .then(blob => {
                blobs.push(blob);
                opts.size = { width: 64, height: 64 };
                return this.croppie.result(opts);
            })
            .then(blob => {
                blobs.push(blob);
                this.props.onSave(blobs);
            });
    };

    render() {
        return (
            <div className="avatar-editor-container">
                <div ref={this.initCroppie} />
                <div className="buttons-container">
                    <Button
                        className="rotate-button"
                        icon="rotate_left"
                        onClick={this.rotateLeft}
                        accent
                    />
                    <Button
                        className="rotate-button"
                        icon="rotate_right"
                        onClick={this.rotateRight}
                        accent
                    />
                    <br />
                    <br />
                    <Button
                        icon="check"
                        label={t('button_save')}
                        onClick={this.handleSave}
                        theme="primary"
                    />
                    <br />
                    <Button
                        icon="close"
                        label={t('button_cancel')}
                        onClick={AvatarEditor.close}
                        theme="primary"
                    />
                </div>
            </div>
        );
    }
}

module.exports = AvatarEditor;
