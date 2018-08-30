import S from './strings';
import { init, send } from './main';
import { duration, errorMessage } from './helpers';
import * as types from './types';

const telemetry = {
    S,
    init,
    send,
    duration,
    errorMessage,
    types
};

export default telemetry;
