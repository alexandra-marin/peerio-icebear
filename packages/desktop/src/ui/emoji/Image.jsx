const React = require('react');
const { observer } = require('mobx-react');

const css = require('classnames');
const { emojiByCanonicalShortname } = require('~/helpers/chat/emoji');

@observer
class EmojiImage extends React.Component {
    render() {
        return (
            <span
                className={css(
                    'emoji-image',
                    this.props.size,
                    emojiByCanonicalShortname[`:${this.props.emoji}:`]
                        .className,
                    this.props.className
                )}
                title={this.props.emoji}
            />
        );
    }
}

module.exports = EmojiImage;
