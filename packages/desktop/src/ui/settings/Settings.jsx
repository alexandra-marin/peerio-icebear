const React = require('react');
const { action, observable } = require('mobx');
const { observer } = require('mobx-react');
const { User } = require('peerio-icebear');
const { t } = require('peerio-translator');
const { Button } = require('peer-ui');
const css = require('classnames');
const appState = require('~/stores/app-state');
const routerStore = require('~/stores/router-store');

@observer
class Settings extends React.Component {
    buttons = [
        {
            route: 'profile',
            label: t('title_settingsProfile'),
            className: css('profile', {
                'tab-notify': !User.current.primaryAddressConfirmed
            })
        },
        {
            route: 'security',
            label: t('title_settingsSecurity')
        },
        {
            route: 'prefs',
            label: t('title_settingsPreferences')
        },
        {
            route: 'account',
            label: t('title_settingsAccount')
        },
        {
            route: 'about',
            label: t('title_About')
        },
        {
            route: 'help',
            label: t('title_help')
        },
        appState.devModeEnabled
            ? {
                  route: 'devSettings',
                  label: 'dev settings'
              }
            : null
    ];

    ROUTES_MAP = this.buttons.reduce((map, button, index) => {
        if (button) {
            map[routerStore.ROUTES[button.route]] = index;
        }
        return map;
    }, {});

    buttonElements = [];
    constructor() {
        super();
        this.buttons.forEach(button => {
            if (!button) return;
            const onClickFunction = (this[
                `to${button.route[0].toUpperCase()}${button.route.slice(1)}`
            ] = () => {
                routerStore.navigateTo(routerStore.ROUTES[button.route]);
            });
            const className = button.className
                ? button.className
                : button.route;

            this.buttonElements.push(
                <Button
                    label={button.label}
                    key={button.label}
                    onClick={onClickFunction}
                    className={className}
                    theme="secondary"
                />
            );
        });
    }

    componentWillMount() {
        this.disposeRouterListener = window.router.listen(
            this.handleRouteChange
        );
    }

    componentWillUnmount() {
        if (this.disposeRouterListener) this.disposeRouterListener();
    }

    @action.bound
    handleRouteChange(route) {
        this.setActive(this.ROUTES_MAP[route.pathname]);
    }

    buttonRefs = [];
    setContainerRef = ref => {
        if (ref) {
            this.buttonRefs = Array.from(ref.childNodes);
            this.setActive(this.ROUTES_MAP[routerStore.currentRoute]);
        }
    };

    @observable indexOfActive;
    @action.bound
    setActive(index) {
        if (this.indexOfActive >= 0) {
            this.buttonRefs[this.indexOfActive].disabled = false;
        }

        if (this.buttonRefs[index]) {
            this.buttonRefs[index].disabled = true;
            this.indexOfActive = index;
        }
    }

    render() {
        return (
            <div className="settings">
                <div className="tab-wrapper">
                    <div className="headline">{t('title_settings')}</div>
                    <div className="tabs" ref={this.setContainerRef}>
                        {this.buttonElements}
                    </div>
                </div>
                {this.props.children}
            </div>
        );
    }
}

module.exports = Settings;
