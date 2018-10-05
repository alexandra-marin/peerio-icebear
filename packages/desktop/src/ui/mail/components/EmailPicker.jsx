const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const { validation } = require('peerio-icebear');
const { Chip, Input } = require('peer-ui');
const { t } = require('peerio-translator');

const emailFormatFn = validation.validators.emailFormat.action;

@observer
class EmailPicker extends React.Component {
    @observable query = '';

    handleTextChange = newVal => {
        const newValLower = newVal.toLocaleLowerCase();
        if (
            newValLower.length > 1 &&
            ', '.includes(newValLower[newValLower.length - 1])
        ) {
            this.query = newValLower
                .substr(0, newValLower.length - 1)
                .replace(/,\s*$/);
            this.validate();
        } else {
            this.query = newValLower.trim();
        }
    };

    validate = () => {
        return emailFormatFn(this.query).then(res => {
            if (res === true) {
                this.props.ghost.recipients.push(this.query);
            }
            this.query = '';
        });
    };

    handleKeyDown = e => {
        if (e.key === 'Enter' && this.query !== '') this.validate();
        if (
            e.key === 'Backspace' &&
            this.query === '' &&
            this.props.ghost.recipients.length > 0
        ) {
            this.props.ghost.recipients.splice(
                this.props.ghost.recipients.length - 1,
                1
            );
        }
    };

    render() {
        return (
            <div className="chip-wrapper">
                {this.props.ghost.recipients.map((c, pos) => (
                    <Chip
                        key={c}
                        deletable
                        onDeleteClick={() =>
                            this.props.ghost.recipients.splice(pos, 1)
                        }
                    >
                        {c}
                    </Chip>
                ))}
                <Input
                    placeholder={t('title_enterEmail')}
                    value={this.query}
                    onChange={this.handleTextChange}
                    onKeyDown={this.handleKeyDown}
                    onBlur={this.validate}
                />
            </div>
        );
    }
}

module.exports = EmailPicker;
