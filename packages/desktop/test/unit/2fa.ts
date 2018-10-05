import { validateCode } from '../../src/helpers/2fa';

describe('2fa helper', () => {
    [
        { code: '', expected: { readyToSubmit: false, isBackupCode: false } },
        { code: 1234, expected: { readyToSubmit: false, isBackupCode: false } },
        {
            code: 123456,
            expected: { readyToSubmit: true, isBackupCode: false }
        },
        {
            code: '1234',
            expected: { readyToSubmit: false, isBackupCode: false }
        },
        {
            code: '123456',
            expected: { readyToSubmit: true, isBackupCode: false }
        },
        {
            code: '   12 3456 ',
            expected: { readyToSubmit: true, isBackupCode: false }
        },
        {
            code: '12-34',
            expected: { readyToSubmit: false, isBackupCode: true }
        },
        {
            code: '12345678',
            expected: { readyToSubmit: true, isBackupCode: false }
        },
        {
            code: '1234-1234-1234-1234',
            expected: { readyToSubmit: true, isBackupCode: true }
        },
        {
            code: '123 4-1 234-1234 - 12 34',
            expected: { readyToSubmit: true, isBackupCode: true }
        },
        { code: '-', expected: { readyToSubmit: false, isBackupCode: true } }
    ].forEach(testCase => {
        it(`should validate code ${JSON.stringify(testCase.code)}`, () => {
            const actual = validateCode(testCase.code.toString());
            expect(actual).toEqual(testCase.expected);
        });
    });
});
