import { telemetry } from 'peerio-icebear';
import { setup } from '~/telemetry/main';
import { DurationEvent, TextInputEvent } from '~/telemetry/types';

const { S, duration, errorMessage } = telemetry;

type StepEvent = [string, { option: string; sublocation: string }];

const ADVANCE_STEPS: StepEvent[] = [
    [S.NAVIGATE, { option: S.NEXT, sublocation: S.ACCOUNT_NAME }],
    [S.NAVIGATE, { option: S.NEXT, sublocation: S.ACCOUNT_USERNAME }],
    [S.NAVIGATE, { option: S.CREATE, sublocation: S.ACCOUNT_EMAIL }]
];

const RETREAT_STEPS: StepEvent[] = [
    null,
    [S.NAVIGATE, { option: S.BACK, sublocation: S.ACCOUNT_USERNAME }],
    [S.NAVIGATE, { option: S.BACK, sublocation: S.ACCOUNT_EMAIL }]
];

const CREATE_ACCOUNT_STEPS: ((startTime: number) => DurationEvent)[] = [
    (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.ACCOUNT_NAME,
                totalTime: duration(startTime)
            }
        ];
    },
    (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.ACCOUNT_EMAIL,
                totalTime: duration(startTime)
            }
        ];
    },
    (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.ACCOUNT_EMAIL,
                totalTime: duration(startTime)
            }
        ];
    }
];

const signup = setup({
    // CreateAccount.tsx
    advanceButton: (step: number) => ADVANCE_STEPS[step],
    retreatButton: (step: number) => RETREAT_STEPS[step],

    goToLogin: [
        S.NAVIGATE,
        {
            option: S.SIGN_IN,
            location: S.ONBOARDING,
            sublocation: S.ACCOUNT_NAME
        }
    ],

    onErrorUsername: (errorMsg: string): TextInputEvent => {
        // Only send the "Name already exists" error
        // The rest of the errors are handled by the onBlur
        if (errorMsg !== 'error_usernameNotAvailable') return null;
        return [
            S.TEXT_INPUT,
            {
                item: S.USERNAME,
                sublocation: S.SIGN_UP,
                state: S.ERROR,
                errorType: errorMessage(errorMsg)
            }
        ];
    },

    useSuggestedUsername: (usernameEnteredManually: boolean) => {
        return [
            S.PICK_USERNAME,
            {
                order: usernameEnteredManually ? 'Second' : 'First'
            }
        ];
    },

    clickNewsletter: (subscribed: boolean) => {
        return [
            S.SET_SETTING,
            {
                option: S.RECEIVE_EMAIL,
                on: subscribed,
                item: S.NEWSLETTER,
                location: S.ONBOARDING
            }
        ];
    },

    durationCreateAccount: (
        currentStep: number,
        startTime: number
    ): DurationEvent => CREATE_ACCOUNT_STEPS[currentStep](startTime),

    // GenerateAccountKey.tsx
    copyAk: [
        S.COPY,
        {
            item: S.ACCOUNT_KEY,
            sublocation: S.ACCOUNT_KEY
        }
    ],

    downloadAk: [
        S.DOWNLOAD,
        {
            item: S.ACCOUNT_KEY,
            sublocation: S.ACCOUNT_KEY
        }
    ],

    confirmDownloadAk: [
        S.DOWNLOAD,
        {
            item: S.ACCOUNT_KEY,
            action: S.SAVED
        }
    ],

    downloadAkReminder: [
        S.DOWNLOAD,
        {
            item: S.ACCOUNT_KEY,
            sublocation: S.TERMS_TOP_DRAWER
        }
    ],

    completeGenerateAk: (akBackedUp: boolean) => {
        return [
            S.NAVIGATE,
            {
                option: akBackedUp ? S.NEXT : S.SKIP,
                sublocation: S.ACCOUNT_KEY
            }
        ];
    },

    durationGenerateAk: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.ACCOUNT_KEY,
                totalTime: duration(startTime)
            }
        ];
    },

    // TermsOfUse.tsx
    readMore: (title: string) => {
        return [
            S.READ_MORE,
            {
                item: title,
                location: S.ONBOARDING
            }
        ];
    },

    declineTerms: [
        S.NAVIGATE,
        {
            option: S.CANCEL,
            sublocation: S.TERMS_OF_USE
        }
    ],

    confirmDeclineTerms: [S.DECLINE_TERMS],
    acceptTerms: [S.ACCEPT_TERMS],

    durationTerms: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.TERMS_OF_USE,
                totalTime: duration(startTime)
            }
        ];
    },

    durationCancelTerms: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.CANCEL_SIGN_UP,
                totalTime: duration(startTime)
            }
        ];
    },

    openTermsDialog: [
        S.READ_MORE,
        {
            item: S.TERMS_OF_USE,
            location: S.ONBOARDING
        }
    ],

    openPrivacyDialog: [
        S.READ_MORE,
        {
            item: S.PRIVACY_POLICY,
            location: S.ONBOARDING
        }
    ],

    // ShareUsageData.tsx
    acceptShareData: [
        S.SET_SETTING,
        {
            option: S.SHARE_DATA,
            on: S.TRUE
        }
    ],
    declineShareData: [
        S.SET_SETTING,
        {
            option: S.SHARE_DATA,
            on: S.FALSE
        }
    ],

    durationShareData: (startTime: number): DurationEvent => {
        return [
            S.DURATION,
            {
                location: S.ONBOARDING,
                sublocation: S.SHARE_DATA,
                totalTime: duration(startTime)
            }
        ];
    },

    finishAccountCreation: [
        S.FINISH_ACCOUNT_CREATION,
        {
            location: S.ONBOARDING
        }
    ]
});

export default signup;
