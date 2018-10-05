const React = require('react');
const { action } = require('mobx');
const { observer } = require('mobx-react');
const BetterInput = require('~/ui/shared-components/BetterInput');
const { chatStore, config } = require('peerio-icebear');
const { t } = require('peerio-translator');
const ELEMENTS = require('~/whitelabel/helpers/elements');

@observer
class ChatNameEditor extends React.Component {
    @action.bound
    setRef(ref) {
        if (ref) this.inputRef = ref;
        if (this.props.innerRef) this.props.innerRef(ref);
    }

    acceptNameEdit = val => {
        try {
            if (this.props.purpose) {
                chatStore.activeChat.changePurpose(val);
            } else {
                ELEMENTS.chatEditor.saveNameChanges(val);
            }
        } catch (err) {
            console.error(err);
        }
    };

    render() {
        const chat = chatStore.activeChat;
        if (!chat || !chat.chatHead) return null;

        const hint = this.props.purpose
            ? 'title_chatPurposeHint'
            : 'title_chatNameHint';
        const label = this.props.purpose ? 'title_purpose' : 'title_title';
        const value = this.props.purpose
            ? chat.purpose
            : ELEMENTS.chatEditor.displayName(chat);
        return (
            <BetterInput
                label={this.props.showLabel ? t(label) : null}
                hint={t(hint)}
                className={this.props.className}
                onFocus={this.props.onFocus}
                onBlur={this.props.onBlur}
                onReject={null}
                onAccept={this.acceptNameEdit}
                onKeyDown={this.props.onKeyDown}
                innerRef={this.setRef}
                value={value}
                tabIndex={this.props.tabIndex}
                readOnly={this.props.readOnly}
                multiline={this.props.multiline}
                maxLength={
                    this.props.purpose
                        ? config.chat.maxChatPurposeLength
                        : config.chat.maxChatNameLength
                }
                theme="transparent"
            />
        );
    }
}

module.exports = ChatNameEditor;
