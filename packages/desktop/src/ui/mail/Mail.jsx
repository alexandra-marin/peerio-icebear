const React = require('react');
const { Button, Menu, MenuItem } = require('peer-ui');
const { observable, action } = require('mobx');
const { observer } = require('mobx-react');
const { ghostStore } = require('peerio-icebear');
const { t } = require('peerio-translator');
const MailItem = require('./components/MailItem');
const MailCompose = require('./components/MailCompose');
const MailSent = require('./components/MailSent');
const ZeroMail = require('./components/ZeroMail');

@observer
class Mail extends React.Component {
    @observable sent = true;

    componentWillMount() {
        ghostStore.loadAllGhosts();
    }

    constructor() {
        super();
        ghostStore.selectedSort = 'date'; // kegID default sort isn't very human
        this.handleCompose = this.handleCompose.bind(this);
        this.handleSend = this.handleSend.bind(this);
        this.handleAttach = this.handleAttach.bind(this);
        this.handleSort = this.handleSort.bind(this);
    }

    @action
    handleCompose() {
        ghostStore.createGhost();
        this.sent = false;
    }

    @action
    handleSend(data) {
        ghostStore.selectedGhost.send(data);
    }

    @action
    handleAttach(files) {
        ghostStore.selectedGhost.attachFiles(files);
    }

    @action
    handleSort(value) {
        ghostStore.sort(value);
    }

    renderRight() {
        if (ghostStore.selectedGhost.sent) {
            return <MailSent ghost={ghostStore.selectedGhost} />;
        }
        return (
            <MailCompose
                ghost={ghostStore.selectedGhost}
                onSend={this.handleSend}
                onFileShare={this.handleAttach}
            />
        );
    }

    render() {
        const availableSorts = [
            { sort: 'date', caption: t('title_sortDate') },
            { sort: 'attachment', caption: t('title_sortAttachments') },
            { sort: 'recipient', caption: t('title_sortRecipients') }
        ];

        return (
            <div className="mail">
                <div className="mail-list-wrapper">
                    <div className="mail-sorting">
                        <div>
                            {t('title_sort')}{' '}
                            <strong>
                                {
                                    availableSorts.find(
                                        s => s.sort === ghostStore.selectedSort
                                    ).caption
                                }
                            </strong>
                        </div>
                        <Menu onSelect={this.handleSort} icon="arrow_drop_down">
                            {availableSorts.map(s => {
                                return (
                                    <MenuItem
                                        key={s.sort}
                                        value={s.sort}
                                        caption={s.caption}
                                    />
                                );
                            })}
                        </Menu>
                    </div>
                    <div className="mail-list">
                        {ghostStore.ghosts.map(m => {
                            return (
                                <MailItem
                                    key={m.ghostId}
                                    sent={m.sent}
                                    ghostId={m.ghostId}
                                    subject={m.subject}
                                    date={m.date.fromNow(true)}
                                    recipient={m.recipients}
                                    attachments={m.files.length > 0}
                                    firstLine={m.preview}
                                    alive={!m.expired && !m.revoked}
                                    active={false}
                                />
                            );
                        })}
                    </div>
                </div>
                {ghostStore.ghosts.length === 0 && !ghostStore.loading ? (
                    <ZeroMail />
                ) : null}
                {ghostStore.selectedId && !ghostStore.loading
                    ? this.renderRight()
                    : null}

                <Button icon="add" onClick={this.handleCompose} />
            </div>
        );
    }
}

module.exports = Mail;
