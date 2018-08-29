import S from './strings';

const ERROR_MESSAGES = {
    error_usernameBadFormat: 'Bad Characters',
    error_usernameNotFound: 'Username Not Found',
    error_usernameNotAvailable: 'Name Already Exists',
    error_invalidEmail: 'Not Valid Email',
    error_addressNotAvailable: 'Email Not Available',
    error_fieldRequired: 'Required',
    error_loginFailed: 'Sign-in Failed',
    error_invalidName: 'Not allowed',
    error_wrongAK: 'Invalid Account Key'
};

function errorMessage(msg: string): string {
    return ERROR_MESSAGES[msg] || msg || 'Unknown Error Type';
}

// Factory for text input events
interface TextInputProps {
    item: string;
    location?: string;
    sublocation?: string;
    state: string;
    errorType?: string;
}
export function textInput(
    item: string,
    location?: string,
    sublocation?: string,
    state?: string,
    errorMsg?: string
) {
    const properties: TextInputProps = { item, state };

    if (location) properties.location = location;
    if (sublocation) properties.sublocation = sublocation;
    if (errorMsg) properties.errorType = errorMessage(errorMsg);

    return [S.TEXT_INPUT, properties];
}

// Factory for duration events
interface DurationProps {
    item?: string;
    location?: string;
    sublocation?: string;
    totalTime: number;
}
export function duration(item: string, location: string, sublocation: string, startTime: number) {
    const totalTime = Math.round((Date.now() - startTime) / 1000);

    const properties: DurationProps = { totalTime };

    if (item) properties.item = item;
    if (location) properties.location = location;
    if (sublocation) properties.sublocation = sublocation;

    return [S.DURATION, properties];
}
