import { telemetry } from 'peerio-icebear';
import { setup } from '~/telemetry/main';
import { DurationEvent, TextInputEvent } from '~/telemetry/types';

const { S, duration, errorMessage } = telemetry;

const login = setup({
    // Login.tsx
    duration: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.SIGN_IN,
                totalTime: duration(startTime)
            }
        ];
    },

    changeUser: ['Change User'],

    onLoginWithEmail: [
        S.TEXT_INPUT,
        {
            item: S.USERNAME,
            location: S.SIGN_IN,
            state: S.ERROR,
            errorType: 'Using @'
        }
    ] as TextInputEvent,

    toggleAkVisibility: (isVisible: boolean) => {
        return [
            S.TOGGLE_VISIBILITY,
            {
                item: S.ACCOUNT_KEY,
                location: S.SIGN_IN,
                visible: isVisible
            }
        ];
    },

    loginFailed: [
        S.TEXT_INPUT,
        {
            item: S.ACCOUNT_KEY,
            location: S.SIGN_IN,
            sublocation: S.SIGN_IN,
            state: S.ERROR,
            errorType: errorMessage('error_wrongAK')
        }
    ],

    onLoginClick: [S.SIGN_IN, { text: S.SIGN_IN }],

    // SignupLink.jsx
    navToCreateAccount: [
        S.START_ACCOUNT_CREATION,
        {
            location: S.SIGN_IN
        }
    ],

    // NewUser.tsx
    newUserDuration: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.WELCOME_SCREEN,
                totalTime: duration(startTime)
            }
        ];
    },

    newUserNavToCreateAccount: [
        S.START_ACCOUNT_CREATION,
        {
            location: S.ONBOARDING,
            sublocation: S.WELCOME_SCREEN
        }
    ],

    newUserNavToSignIn: [
        S.NAVIGATE,
        {
            option: S.SIGN_IN,
            location: S.ONBOARDING,
            sublocation: S.WELCOME_SCREEN
        }
    ]
});

export default login;
