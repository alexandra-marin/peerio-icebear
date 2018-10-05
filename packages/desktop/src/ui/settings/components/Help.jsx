const React = require('react');
const { when } = require('mobx');
const { observer } = require('mobx-react');
const { Button } = require('peer-ui');
const { t } = require('peerio-translator');
const T = require('../../shared-components/T');
const config = require('~/config');
const urls = require('~/config').translator.urlMap;
const { contactStore, chatStore, warnings } = require('peerio-icebear');
const { clipboard } = require('electron').remote;

@observer
class Help extends React.Component {
    feedback = () => {
        console.log('feedback', config.contacts.feedbackUser);
        const feedback = contactStore.getContact(config.contacts.feedbackUser);
        when(
            () => !feedback.loading,
            () => {
                chatStore.startChat([feedback]);
                window.router.push('/app/chats');
            }
        );
    };

    support = () => {
        const support = contactStore.getContact(config.contacts.supportUser);
        when(
            () => !support.loading,
            () => {
                chatStore.startChat([support]);
                window.router.push('/app/chats');
            }
        );
    };

    copyLogs = () => {
        clipboard.writeText(console.history.toString());
        warnings.add('snackbar_logsCopied');
    };

    render() {
        return (
            <div className="help-container">
                <section className="section-divider">
                    <div className="title">{t('title_support')}</div>
                    <div className="text">
                        <T k="title_helpText" />
                        <Button
                            icon="live_help"
                            href={urls.helpCenter}
                            tooltip={t('button_HC')}
                            theme="no-hover"
                        />
                    </div>
                    <div className="text">
                        <T k="title_supportIntro" />
                        <Button
                            icon="question_answer"
                            onClick={this.support}
                            tooltip={t('button_supportChat')}
                            theme="no-hover"
                        />
                        <Button
                            icon="email"
                            href={urls.contactSupport}
                            tooltip={t('button_supportEmail')}
                            theme="no-hover"
                        />
                    </div>
                </section>
                <section className="section-divider">
                    <div className="title">{t('title_feedback')}</div>
                    <div className="text">
                        <T k="title_feedbackIntro" />
                        <Button
                            icon="question_answer"
                            onClick={this.feedback}
                            tooltip={t('button_feedbackChat')}
                            theme="no-hover"
                        />
                    </div>
                </section>
                <section>
                    <div className="title">{t('title_logs')}</div>
                    <div className="text">
                        <T k="title_logsIntro" />
                        <Button
                            icon="content_copy"
                            onClick={this.copyLogs}
                            tooltip={t('button_copyLogs')}
                            theme="no-hover"
                        />
                    </div>
                </section>
            </div>
        );
    }
}

module.exports = Help;
