const React = require('react');
const { observer } = require('mobx-react');

/*  eslint-disable react/require-render-return */
@observer
class MailCompose extends React.Component {
    render() {
        throw new Error('The MailCompose component needs to be rewritten.');
    }
}
/*  eslint-enable react/require-render-return */

module.exports = MailCompose;
