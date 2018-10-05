import React from 'react';
import { Route, IndexRoute } from 'react-router';

import App from '~/ui/App';
import Root from '~/ui/Root';
import Chat from '~/whitelabel/components/Chat';
import NewChannel from '~/whitelabel/components/NewChannel';

import Welcome from './Welcome';
import Onboarding from './Onboarding';
import Login from './login/Login';
import Signup from './signup/Signup';
import NewUser from './login/NewUser';
import Loading from './Loading';
import ChatView from './chat/ChatView';
import NewChat from './chat/NewChat';
import ChannelInvite from './chat/components/ChannelInvite';
import PendingDMDismissed from './chat/components/PendingDMDismissed';
import Patient from './whitelabel/medcryptor/Patient';
import Files from './files/Files';
import Mail from './mail/Mail';
import Settings from './settings/Settings';
import Profile from './settings/components/ProfileSettings';
import Security from './settings/components/SecuritySettings';
import Preferences from './settings/components/Preferences';
import Account from './settings/components/Account';
import About from './settings/components/About';
import Help from './settings/components/Help';
import DevTools from './dev-tools/DevTools';
import DTDashboard from './dev-tools/Dashboard';
import KegEditor from './dev-tools/KegEditor';
import NewDevice from './login/NewDevice';
import AutoLogin from './login/AutoLogin';
import Contacts from './contact/Contacts';
import InvitedContacts from './contact/InvitedContacts';
import ContactList from './contact/ContactList';
import NewContact from './contact/NewContact';
import DevSettings from './settings/components/Dev';

export default (
    <Route path="/" component={Root}>
        <IndexRoute component={Login} />
        <Route path="/" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/new-user" component={NewUser} />
        <Route path="/new-device" component={NewDevice} />
        <Route path="autologin" component={AutoLogin} />
        <Route path="/app" component={App}>
            <IndexRoute component={Loading} />
            <Route path="welcome" component={Welcome} />
            <Route path="chats" component={Chat}>
                <IndexRoute component={ChatView} />
                <Route path="channel-invite" component={ChannelInvite} />
                <Route path="new-chat" component={NewChat} />
                <Route path="new-channel" component={NewChannel} />
                <Route
                    path="pending-dm-dismissed"
                    component={PendingDMDismissed}
                />
                <Route path="new-patient" component={NewChannel} />
            </Route>
            <Route path="patients" component={Patient}>
                <IndexRoute component={ChatView} />
                <Route path="new-internal-room" component={NewChannel} />
                <Route path="new-patient-room" component={NewChannel} />
            </Route>
            <Route path="files" component={Files} />
            <Route path="onboarding" component={Onboarding} />
            <Route path="contacts" component={Contacts}>
                <IndexRoute component={ContactList} />
                <Route path="invited" component={InvitedContacts} />
                <Route path="new-contact" component={NewContact} />
                <Route path="new-invite" component={NewContact} />
            </Route>
            <Route path="mail" component={Mail} />
            <Route path="settings" component={Settings}>
                <Route path="profile" component={Profile} />
                <Route path="security" component={Security} />
                <Route path="preferences" component={Preferences} />
                <Route path="account" component={Account} />
                <Route path="about" component={About} />
                <Route path="help" component={Help} />
                <Route path="dev" component={DevSettings} />
            </Route>
        </Route>
        <Route path="/dev-tools" component={DevTools}>
            <IndexRoute component={DTDashboard} />
            <Route path="kegs" component={KegEditor} />
        </Route>
    </Route>
);
