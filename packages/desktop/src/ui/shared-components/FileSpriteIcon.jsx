const React = require('react');
const { observer } = require('mobx-react');
const css = require('classnames');

@observer
class FileSpriteIcon extends React.Component {
    /* props
        size: small, medium, large, xlarge
        type: img, audio, video, txt, zip, pdf, ai, psd, word, xls, ppt, other
    */

    get pxResolution() {
        switch (this.props.size) {
            case 'small':
                return 'ic-24dp';
            default:
            case 'medium':
                return 'ic-32dp';
            case 'large':
                return 'ic-48dp';
            case 'xlarge':
                return 'ic-56dp';
        }
    }

    render() {
        const fileIconType = `ic-file-${this.props.type}-${this.props.size}`;
        return (
            <div
                className={css(
                    'file-sprite-icon',
                    fileIconType,
                    this.pxResolution
                )}
            />
        );
    }
}

module.exports = FileSpriteIcon;
