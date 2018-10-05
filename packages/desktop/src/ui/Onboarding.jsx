const React = require('react');
const { observable } = require('mobx');
const { observer } = require('mobx-react');
const css = require('classnames');
const { MaterialIcon } = require('peer-ui');
const UsageCloud = require('~/ui/shared-components/UsageCloud');
const { User } = require('peerio-icebear');
const T = require('~/ui/shared-components/T');
const { t } = require('peerio-translator');

function createOnboardingItem(
    icon,
    title,
    description,
    descriptionFinished,
    valueFn,
    action,
    extraClass,
    buttonItem
) {
    return {
        icon,
        title,
        description,
        descriptionFinished,
        valueFn,
        action,
        extraClass,
        buttonItem
    };
}

@observer
class Onboarding extends React.Component {
    @observable waiting = false;

    get items() {
        const {
            currentInvitedPeopleBonus,
            maxInvitedPeopleBonus
        } = User.current;
        return [
            createOnboardingItem(
                'mail',
                t('title_onboardingConfirmEmail'),
                t('title_onboardingConfirmEmailContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasConfirmedEmailBonus,
                () => window.router.push('/app/settings/profile')
            ),
            createOnboardingItem(
                'settings',
                t('title_onboardingAvatar'),
                t('title_onboardingAvatarContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasAvatarUploadedBonus,
                () => window.router.push('/app/settings/profile')
            ),
            createOnboardingItem(
                'file_download',
                t('title_onboardingAccountKey'),
                t('title_onboardingAccountKeyContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasAccountKeyBackedUpBonus,
                () => window.router.push('/app/settings/security')
            ),
            createOnboardingItem(
                'forum',
                t('title_onboardingCreateARoom'),
                t('title_onboardingCreateARoomContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasCreatedRoomBonus,
                () => window.router.push('/app/chats/new-channel')
            ),
            createOnboardingItem(
                'person_add',
                t('title_onboardingInvitePeople', {
                    current: currentInvitedPeopleBonus,
                    max: maxInvitedPeopleBonus
                }),
                t('title_onboardingInvitePeopleContent'),
                t('title_onboardingStorageUnlocked', { amount: '250' }),
                () => currentInvitedPeopleBonus >= maxInvitedPeopleBonus,
                () => window.router.push('/app/contacts')
            ),
            createOnboardingItem(
                'phonelink_setup',
                t('title_onboardingTSV'),
                t('title_onboardingTSVContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasTwoFABonus,
                () => window.router.push('/app/settings/security')
            ),
            createOnboardingItem(
                'phonelink_setup',
                <T k="title_onboardingInstallMobileApp" />,
                t('title_onboardingInstallMobileAppContent'),
                t('title_onboardingStorageUnlocked', { amount: '100' }),
                () => User.current.hasInstallBonus
            )
        ];
    }

    renderItem = (item, index) => {
        const {
            icon,
            title,
            description,
            descriptionFinished,
            valueFn,
            action,
            extraClass,
            buttonItem
        } = item;
        const done = valueFn();
        return (
            <div
                key={title}
                onClick={done ? null : action}
                className={css('onboarding-to-do', {
                    'done-first': done && index === 0,
                    done,
                    clickable: !done && !!action
                })}
            >
                <div className="done-container">
                    <MaterialIcon icon={done ? 'check' : icon} />
                    <div className="extraclass-container">
                        <div className={`title ${extraClass}`}>
                            {title}
                            {buttonItem}
                        </div>
                        <p>{done ? descriptionFinished : description}</p>
                    </div>
                </div>
            </div>
        );
    };

    render() {
        const { currentOnboardingBonus, maximumOnboardingBonus } = User.current;
        return (
            <div className="onboarding">
                <div className="onboarding-content">
                    <div className="display-1">{t('title_onboarding1')}</div>
                    <div className="title">{t('title_onboarding2')}</div>
                    <p>
                        {t('title_earned', {
                            current: currentOnboardingBonus,
                            max: maximumOnboardingBonus
                        })}
                    </p>
                    <div className="onboarding-to-dos">
                        {this.items
                            .filter(item => !item.valueFn())
                            .map(this.renderItem)}
                        {this.items
                            .filter(item => item.valueFn())
                            .map(this.renderItem)}
                    </div>
                    <div className="usage-cloud-container">
                        <UsageCloud />
                    </div>
                    <div className="onboarding-info">
                        {t('title_onboardingLink')}
                    </div>
                </div>
            </div>
        );
    }
}

module.exports = Onboarding;
