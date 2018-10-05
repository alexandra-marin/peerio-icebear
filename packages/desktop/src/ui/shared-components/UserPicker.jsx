const React = require('react');
const { observable, computed, when, transaction, reaction } = require('mobx');
const { observer } = require('mobx-react');
const {
    Avatar,
    Button,
    Chip,
    Input,
    List,
    ListHeading,
    ListItem,
    MaterialIcon,
    ProgressBar
} = require('peer-ui');
const UserSearchError = require('~/whitelabel/components/UserSearchError');
const { t } = require('peerio-translator');
const { fileStore, contactStore, User } = require('peerio-icebear');
const css = require('classnames');
const T = require('~/ui/shared-components/T');
const { getAttributeInParentChain } = require('~/helpers/dom');
const routerStore = require('~/stores/router-store');

@observer
class UserPicker extends React.Component {
    @observable selected = [];
    @observable query = '';
    accepted = false;
    @observable suggestInviteEmail = '';
    @observable showNotFoundError;
    @observable userAlreadyAdded = '';
    @observable foundContact;
    @observable contactLoading = false;
    @observable _searchUsernameTimeout = false;

    @computed
    get showSearchError() {
        return (
            this.suggestInviteEmail ||
            this.showNotFoundError ||
            this.userAlreadyAdded
        );
    }

    @computed
    get isRoomCreation() {
        return (
            routerStore.isNewChannel ||
            routerStore.isNewPatient ||
            routerStore.isNewPatientRoom ||
            routerStore.isNewInternalRoom
        );
    }

    componentDidMount() {
        if (this.props.onChange) {
            this.selected.observe(() => this.props.onChange(this.selected));
        }

        // Reset search and selection when changing between two views that both use UserPicker
        this.disposer = reaction(
            () => routerStore.currentRoute,
            () => {
                this.reset();
                this.selected = [];
            }
        );
    }

    componentWillUnmount() {
        this.disposer();
    }

    @computed
    get options() {
        const ret = contactStore.whitelabel
            .filter(this.query, this.props.context)
            .filter(this.filterOptions);
        const favorites = ret.filter(s => s.isAdded);
        const normal = ret.filter(s => !s.isAdded);
        return {
            favorites,
            normal
        };
    }

    @computed
    get isValid() {
        return !this.selected.find(s => s.loading || s.notFound || s.isHidden);
    }

    @computed
    get selectedSelfless() {
        return this.selected.filter(this.selfFilter);
    }

    @computed
    get queryIsEmpty() {
        return !this.query.trim().length;
    }

    filterOptions = item => {
        if (this.selected.find(s => s.username === item.username)) return false;
        if (this.props.noDeleted && item.isDeleted) return false;
        if (item.isMe) return false;
        if (this.isExcluded(item)) return false;

        return true;
    };

    isExcluded(contact) {
        if (
            this.props.exceptContacts &&
            this.props.exceptContacts.includes(contact)
        )
            return true;
        return false;
    }

    selfFilter(contact) {
        return contact.username !== User.current.username;
    }

    reset() {
        this.showNotFoundError = false;
        this.userAlreadyAdded = '';
        this.suggestInviteEmail = '';
        this.foundContact = null;
    }

    handleTextChange = newVal => {
        this.reset();
        const newValLower = newVal.toLocaleLowerCase();
        if (this.props.limit === 1) {
            this.query = newValLower.trim();
            this.searchUsernameTimeout(this.query);
            return;
        }
        if (
            newValLower.length > 1 &&
            ', '.includes(newValLower[newValLower.length - 1])
        ) {
            this.query = newValLower.substr(0, newValLower.length - 1).trim();
            this.tryAcceptUsername();
            return;
        }
        this.query = newValLower.trim();
    };

    // Don't use onKeyPress it won't catch backspace
    // Don't use onKeyUp - text change fires earlier
    handleKeyDown = async e => {
        if (e.key === 'Enter' && this.query !== '') {
            // if we are in 1-1 DM selection and user hits enter
            if (this.props.limit === 1) {
                const c =
                    this.foundContact ||
                    (await this.searchUsername(this.query));
                // if we know for sure contact is there, then go to DM immediately
                if (c && !c.loading && !c.notFound && !c.isHidden) {
                    this.query = '';
                    this.selected = [c];
                    this.accept();
                }
                return;
            }
            this.tryAcceptUsername();
        }
        if (
            e.key === 'Backspace' &&
            this.query === '' &&
            this.selected.length > 0
        ) {
            this.selected.remove(this.selected[this.selected.length - 1]);
        }
    };

    searchUsernameTimeout(q) {
        if (this._searchUsernameTimeout) {
            clearTimeout(this._searchUsernameTimeout);
            this._searchUsernameTimeout = null;
        }
        if (!q) return;
        this._searchUsernameTimeout = setTimeout(() => {
            transaction(() => {
                this._searchUsernameTimeout = null;
                this.searchUsername(q);
            });
        }, 1000);
    }

    async searchUsername(q) {
        if (!q) return null;
        this.contactLoading = true;
        let c = await contactStore.whitelabel.getContact(q, this.props.context);
        if (this.isExcluded(c)) {
            this.userAlreadyAdded = this.query;
            c = null;
        } else {
            const atInd = q.indexOf('@');
            const isEmail = atInd > -1 && atInd === q.lastIndexOf('@');
            const userHiddenOrNotFound = c.notFound || c.isHidden;
            this.userNotFound = userHiddenOrNotFound ? q : '';
            this.suggestInviteEmail =
                userHiddenOrNotFound && isEmail && !this.props.noInvite
                    ? q
                    : '';
            this.showNotFoundError = userHiddenOrNotFound;
            this.foundContact = !userHiddenOrNotFound && c;
        }
        this.contactLoading = false;
        return c;
    }

    async tryAcceptUsername() {
        this.reset();
        const c = await this.searchUsername(this.query);
        if (c === null || this.selected.find(s => s.username === this.query)) {
            return;
        }
        this.query = '';
        if (this.isExcluded(c)) {
            return;
        }
        this.selected.push(c);
        when(
            () => !c.loading,
            () => {
                setTimeout(() => {
                    if (c.notFound || c.isHidden) this.selected.remove(c);
                }, 1000);
            }
        );
    }

    accept = () => {
        if (this.query) {
            this.tryAcceptUsername();
            return;
        }
        if (this.props.onlyPick || this.accepted || !this.isValid) return;
        this.accepted = true;
        this.selected.forEach(s => {
            if (s.notFound || s.isHidden) this.selected.remove(s);
        });
        this.props.onAccept(this.selected);
    };

    onInputMount = input => {
        if (!input || this.props.noAutoFocus) return;
        input.focus();
    };

    handleClose = () => {
        this.props.onClose();
    };

    onContactClick = ev => {
        const username = getAttributeInParentChain(ev.target, 'data-id');
        // avoiding incorrect setState because of computed options
        setTimeout(() => {
            const c = contactStore.getContact(username);
            if (this.props.limit === 1) {
                this.selected.clear();
                this.selected.push(c);
                this.query = '';
                this.accept();
                return;
            }
            this.query = '';
            if (this.isExcluded(c)) return;
            if (this.selected.find(i => i.username === c.username)) return;
            this.selected.push(c);
        });
    };

    invite = context => {
        contactStore.invite(this.suggestInviteEmail, context);
        this.query = '';
        this.reset();
    };

    renderList(subTitle, items) {
        if (!items.length) return null;
        return (
            <div key={subTitle} className="user-list">
                {!!subTitle && (
                    <ListHeading
                        key={subTitle}
                        caption={`${t(subTitle)} (${items.length})`}
                    />
                )}
                {items.map(c => (
                    <span key={c.username} data-id={c.username}>
                        <ListItem
                            leftContent={
                                <Avatar key="a" contact={c} size="medium" />
                            }
                            caption={c.username}
                            legend={`${c.firstName} ${c.lastName}`}
                            onClick={this.onContactClick}
                        />
                    </span>
                ))}
            </div>
        );
    }

    render() {
        const selectedFiles = fileStore.selectedFiles;

        return (
            <div className="user-picker">
                <div
                    className={css('selected-items', {
                        banish: !this.props.sharing
                    })}
                >
                    <List clickable>
                        <ListHeading
                            key="header"
                            caption={t('title_selectedFiles')}
                        />
                        {selectedFiles.map(f => (
                            <ListItem
                                key={f.id}
                                leftIcon="insert_drive_file"
                                caption={f.name}
                                rightIcon={
                                    selectedFiles.length > 1
                                        ? 'remove_circle_outline'
                                        : undefined
                                }
                            />
                        ))}
                    </List>
                </div>
                <div className="inputs-container">
                    <div className="inputs-container-inner">
                        <div className="chat-creation-header-container">
                            {this.props.noHeader ? null : (
                                <div className="chat-creation-header">
                                    <div className="title">
                                        {this.props.title}
                                        {this.props.description && (
                                            <span className="description">
                                                {this.props.description}
                                            </span>
                                        )}
                                    </div>
                                    {this.props.closeable && (
                                        <Button
                                            icon="close"
                                            onClick={this.handleClose}
                                            className="button-close"
                                        />
                                    )}
                                </div>
                            )}
                            <div className="message-search-wrapper">
                                <div className="message-search-inner">
                                    {this.props.isDM && (
                                        <T k="title_to" className="title-to" />
                                    )}
                                    <div className="new-chat-search">
                                        <MaterialIcon icon="search" />
                                        <div className="chip-wrapper">
                                            {this.selected.map(c => (
                                                <Chip
                                                    key={c.username}
                                                    className={css({
                                                        'not-found':
                                                            c.notFound ||
                                                            c.isHidden
                                                    })}
                                                    onDeleteClick={() =>
                                                        this.selected.remove(c)
                                                    }
                                                    deletable
                                                >
                                                    {c.loading ? (
                                                        <ProgressBar
                                                            type="linear"
                                                            mode="indeterminate"
                                                        />
                                                    ) : (
                                                        c.username
                                                    )}
                                                </Chip>
                                            ))}
                                            <Input
                                                innerRef={this.onInputMount}
                                                placeholder={
                                                    routerStore.isNewChannel ||
                                                    routerStore.isPatientSpace
                                                        ? t('title_Members')
                                                        : routerStore.isNewPatient
                                                            ? t(
                                                                  'mcr_title_newPatientRecord'
                                                              )
                                                            : t(
                                                                  'title_userSearch'
                                                              )
                                                }
                                                value={this.query}
                                                onChange={this.handleTextChange}
                                                onKeyDown={this.handleKeyDown}
                                            />
                                        </div>
                                        {this.props.limit !== 1 &&
                                            this.props.onAccept &&
                                            !this.isRoomCreation && (
                                                <Button
                                                    label={
                                                        this.props.button ||
                                                        t('button_go')
                                                    }
                                                    onClick={this.accept}
                                                    disabled={
                                                        !this.isValid ||
                                                        (this.queryIsEmpty &&
                                                            this.selected
                                                                .length === 0)
                                                    }
                                                    theme="affirmative"
                                                />
                                            )}
                                        {(this.contactLoading ||
                                            this._searchUsernameTimeout) && (
                                            <ProgressBar
                                                type="circular"
                                                mode="indeterminate"
                                                size="small"
                                            />
                                        )}
                                    </div>
                                </div>
                                {this.isRoomCreation && (
                                    <div className="helper-text">
                                        <T k="title_userSearch" />.{' '}
                                        <T k="title_optional" />
                                    </div>
                                )}
                            </div>
                            {this.isRoomCreation && (
                                <div className="new-channel-button-container">
                                    <Button
                                        label={t('button_open')}
                                        onClick={this.props.onAccept}
                                        disabled={this.props.noSubmit}
                                        theme="affirmative"
                                    />
                                </div>
                            )}
                        </div>
                        {this.showSearchError && (
                            <div className="user-search-error-container">
                                <UserSearchError
                                    userAlreadyAdded={this.userAlreadyAdded}
                                    userNotFound={
                                        this.showNotFoundError &&
                                        !this.suggestInviteEmail
                                            ? this.userNotFound
                                            : null
                                    }
                                    suggestInviteEmail={this.suggestInviteEmail}
                                    onInvite={this.invite}
                                />
                            </div>
                        )}
                        <div className="user-list-container">
                            <List theme="large" clickable>
                                {this.foundContact &&
                                    this.renderList(null, [this.foundContact])}
                                {this.renderList(
                                    'title_favoriteContacts',
                                    this.options.favorites
                                )}
                                {this.renderList(
                                    'title_allContacts',
                                    this.options.normal
                                )}
                            </List>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = UserPicker;
