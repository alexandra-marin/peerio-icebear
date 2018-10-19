const ERROR_MESSAGES = {
    error_usernameBadFormat: 'Bad Characters',
    error_usernameNotFound: 'Username Not Found',
    error_usernameNotAvailable: 'Name Already Exists',
    error_invalidEmail: 'Not Valid Email',
    error_addressTaken: 'Email Not Available',
    error_fieldRequired: 'Required',
    error_loginFailed: 'Sign-in Failed',
    error_invalidName: 'Not allowed',
    error_wrongAK: 'Invalid Account Key'
};

export function errorMessage(msg: string): string {
    return ERROR_MESSAGES[msg] || msg;
}

export function duration(startTime: number): number {
    return Math.round((Date.now() - startTime) / 1000);
}
