import { telemetry } from 'peerio-icebear';
import login from './components/login';
import signup from './components/signup';
import shared from './components/shared';

function init() {
    telemetry.init();
}

export { init, login, signup, shared };
