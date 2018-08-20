/**
 * Various file helpers
 * @alias fileHelpers
 */

/**
 * Extracts file name+extension portion from any path.
 * @param {string} path
 * @returns {string} file name and extension without any parent folders.
 */
function getFileName(path) {
    return path.replace(/^.*[\\/]/, '');
}

/**
 * Extracts file name without extension from any path
 * @param {string} path
 * @returns {string} file name without extension
 */
function getFileNameWithoutExtension(path) {
    return getFileName(path).replace(/\.\w+$/, '');
}

/**
 * Extracts file extension from any path.
 * @param {string} path
 * @returns {string} file extension
 */
function getFileExtension(path) {
    let extension = path.toLocaleLowerCase().match(/\.\w+$/);
    extension = extension ? extension[0].substring(1) : '';
    return extension;
}

/**
 * For use with FileSpriteIcon. Determines general file "type" based on extension.
 * @param {string} file extension
 * @returns {string} file type
 */
const fileIconType = {
    txt: 'txt',
    pdf: 'pdf',
    ai: 'ai',
    psd: 'psd'
};
function createFileType(ext, type) {
    fileIconType[ext] = type;
}
['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff'].forEach(ext =>
    createFileType(ext, 'img')
);
['aif', 'aiff', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav'].forEach(ext =>
    createFileType(ext, 'audio')
);
['avi', 'flv', 'm4v', 'mov', 'mp4', 'mpeg', 'mpg', 'wbm', 'wmv'].forEach(ext =>
    createFileType(ext, 'video')
);
['7z', 'gz', 'rar', 'zip', 'zipx'].forEach(ext => createFileType(ext, 'zip'));
['doc', 'docx'].forEach(ext => createFileType(ext, 'word'));
['xls', 'xlsx'].forEach(ext => createFileType(ext, 'xls'));
['ppt', 'pptx'].forEach(ext => createFileType(ext, 'ppt'));

function getFileIconType(ext) {
    return fileIconType[ext] ? fileIconType[ext] : 'other';
}

const IMAGE_EXTS = { png: true, jpg: true, jpeg: true, bmp: true, gif: true };

function isImage(ext) {
    return !!IMAGE_EXTS[ext.toLowerCase().trim()];
}

/*

Unicode's right-to-left overrides in filenames may cause confusion
and have been exploited for a long time:

* 2011: https://boingboing.net/2011/10/03/unicodes-right-to-left-override-obfuscates-malwares-filenames.html
* 2014: https://blog.malwarebytes.com/cybercrime/2014/01/the-rtlo-method/
* 2017: https://securelist.com/zero-day-vulnerability-in-telegram/83800/

As an example, this filename:

    "photo\u202egnp.js"

will be displayed as:

    photojs.png

making the user think this is a PNG picture, while in reality it's a .js file.

To prevent this from being exploited -- specifically, for confusing users
about the real extension -- we split filename into name and extension parts
and then sanitize each separately, making sure each \u202e (RIGHT-TO-LEFT OVERRIDE)
is followed at the end of the part by \u202c (POP DIRECTIONAL FORMATTING)
which undoes the text direction change. If our sanitization is applied
to the example above, it would be displayed as:

    photopng.js

*/

// Regex for matching opening Directional Formatting Codes.
const DFC_RX = /[\u202A-\u202E\u2066-\u2068]/;

function sanitizeBidirectionalFilePart(name) {
    // Quickly check if name contains characters we're interested in
    // (only those that push to formatting stack, not pop).
    if (name.length === 0 || !DFC_RX.test(name)) {
        return name;
    }

    let formattingCount = 0;
    let hadFormattingPop = false;
    let isolateCount = 0;
    let hadIsolatePop = false;

    for (let i = 0; i < name.length; i++) {
        switch (name.charCodeAt(i)) {
            case 0x202a: // LEFT-TO-RIGHT EMBEDDING
            case 0x202b: // RIGHT-TO-LEFT EMBEDDING
            case 0x202d: // LEFT-TO-RIGHT OVERRIDE
            case 0x202e: // RIGHT-TO-LEFT OVERRIDE
                formattingCount++;
                hadFormattingPop = false;
                break;
            case 0x202c: // POP DIRECTIONAL FORMATTING
                if (!hadFormattingPop && formattingCount > 0) {
                    formattingCount--;
                }
                hadFormattingPop = true;
                break;

            case 0x2066: // LEFT-TO-RIGHT ISOLATE
            case 0x2067: // RIGHT-TO-LEFT ISOLATE
            case 0x2068: // FIRST STRONG ISOLATE
                isolateCount++;
                hadIsolatePop = false;
                break;
            case 0x2069: // POP DIRECTIONAL ISOLATE
                if (!hadIsolatePop && isolateCount > 0) {
                    isolateCount--;
                }
                hadIsolatePop = true;
                break;
            default:
            // nothing
        }
    }
    // If counts aren't zero, add more pops.
    while (formattingCount--) {
        // eslint-disable-next-line no-param-reassign
        name += String.fromCharCode(0x202c); // POP DIRECTIONAL FORMATTING
    }
    while (isolateCount--) {
        // eslint-disable-next-line no-param-reassign
        name += String.fromCharCode(0x2069); // POP DIRECTIONAL ISOLATE
    }

    return name;
}

function sanitizeBidirectionalFilename(filename) {
    // Filename and extension are sanitize separately
    // to ensure that bad name bidirectional formatting
    // won't "corrupt" extension, and vice versa.
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex >= 0) {
        const name = sanitizeBidirectionalFilePart(filename.substring(0, dotIndex));
        const ext = sanitizeBidirectionalFilePart(filename.substring(dotIndex + 1));
        return `${name}.${ext}`;
    }
    return sanitizeBidirectionalFilePart(filename);
}

export default {
    getFileName,
    getFileExtension,
    getFileNameWithoutExtension,
    getFileIconType,
    isImage,
    sanitizeBidirectionalFilename
};
