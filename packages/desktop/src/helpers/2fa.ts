const noSpaceRegex = /\s+/g;

/**
 * Checks if totp code (or backup code) is ready to submit
 */
export function validateCode(
    code: string
): { isBackupCode: boolean; readyToSubmit: boolean } {
    const normalized = (code || '').toString().replace(noSpaceRegex, '');

    const res = { isBackupCode: false, readyToSubmit: false };

    if (normalized.includes('-')) {
        res.isBackupCode = true;
        if (normalized.length >= 19) {
            res.readyToSubmit = true;
        }
        return res;
    }
    if (normalized.length >= 6) {
        res.readyToSubmit = true;
    }
    return res;
}
