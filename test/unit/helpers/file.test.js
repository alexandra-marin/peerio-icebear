const helper = require('~/helpers/file');

describe('File helper should', () => {
    const paths = [
        {
            data: 'noext',
            expectedFullName: 'noext',
            expectedName: 'noext',
            expectedExt: ''
        },
        {
            data: ' noext   and spaces ',
            expectedFullName: ' noext   and spaces ',
            expectedName: ' noext   and spaces ',
            expectedExt: ''
        },
        {
            data: 'justfile.ext',
            expectedFullName: 'justfile.ext',
            expectedName: 'justfile',
            expectedExt: 'ext'
        },
        {
            data: 'just file.longext',
            expectedFullName: 'just file.longext',
            expectedName: 'just file',
            expectedExt: 'longext'
        },
        {
            data: 'weirdfile.withdot.txt',
            expectedFullName: 'weirdfile.withdot.txt',
            expectedName: 'weirdfile.withdot',
            expectedExt: 'txt'
        },
        {
            data: 'weirdfile.with dots. and spaces.txt',
            expectedFullName: 'weirdfile.with dots. and spaces.txt',
            expectedName: 'weirdfile.with dots. and spaces',
            expectedExt: 'txt'
        },
        {
            data: '.justext',
            expectedFullName: '.justext',
            expectedName: '',
            expectedExt: 'justext'
        }
    ];

    const folders = [
        '/',
        '/regular/',
        'with space/',
        'with.dot/',
        '../folder/',
        '/folder/nested/',
        'c:\\windows style\\',
        'also\\windows\\'
    ];

    const unicode = [
        {
            name: 'photo\u202egnp.js',
            expectedSanitizedName: 'photo\u202egnp\u202c.js'
        },
        {
            name: '2photo\u202egnp.js\u2067',
            expectedSanitizedName: '2photo\u202egnp\u202c.js\u2067\u2069'
        },
        {
            name: '\u202c\u202cphoto\u202egnp.js',
            expectedSanitizedName: '\u202c\u202cphoto\u202egnp\u202c.js'
        },
        {
            name: '\u202c\u202cphoto\u202c\u202egnp.js',
            expectedSanitizedName: '\u202c\u202cphoto\u202c\u202egnp\u202c.js'
        }
    ];

    folders.forEach(f => {
        paths.concat(paths.map(p => f + p));
    });

    paths.forEach((testCase) => {
        it(`return file name from path ${testCase.data}`, () => {
            const actual = helper.getFileName(testCase.data);
            actual.should.equal(testCase.expectedFullName);
        });

        it(`return file name without extension from path ${testCase.data}`, () => {
            const actual = helper.getFileNameWithoutExtension(testCase.data);
            actual.should.equal(testCase.expectedName);
        });

        it(`return extension from path ${testCase.data}`, () => {
            const actual = helper.getFileExtension(testCase.data);
            actual.should.equal(testCase.expectedExt);
        });
    });

    unicode.forEach((testCase) => {
        it('sanitizes broken bi-directional formatting', () => {
            const sanitized = helper.sanitizeBidirectionalFilename(testCase.name);
            sanitized.should.equal(testCase.expectedSanitizedName);
        });
    });
});

