import S from './strings';
import { init, send } from './main';
import { duration, errorMessage } from './helpers';

const telemetry = {
    S,
    init,
    send,
    duration,
    errorMessage
};

export default telemetry;
