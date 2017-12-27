/**
 * Various file helpers
 * @module helpers/file
 * @alias fileHelpers
 * @public
 */

// jsdoc hack..
let a; //eslint-disable-line

/**
 * Extracts file name+extension portion from any path.
 * @param {string} path
 * @returns {string} file name and extension without any parent folders.
 * @memberof helpers/file
 * @public
 */
function getFileName(path) {
    return path.replace(/^.*[\\/]/, '');
}

/**
 * Extracts file name without extension from any path
 * @param {string} path
 * @returns {string} file name without extension
 * @memberof helpers/file
 * @public
 */
function getFileNameWithoutExtension(path) {
    return getFileName(path).replace(/\.\w+$/, '');
}

/**
 * Extracts file extension from any path.
 * @param {string} path
 * @returns {string} file extension
 * @memberof helpers/file
 * @public
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
 * @memberof helpers/file
 * @public
 */
const fileIconType = {
    txt: 'txt',
    pdf: 'pdf',
    ai: 'ai',
    psd: 'psd'
};
function createFileType(ext, type) { fileIconType[ext] = type; }
['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff'].forEach((ext) => createFileType(ext, 'img'));
['aif', 'aiff', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav'].forEach((ext) => createFileType(ext, 'audio'));
['avi', 'flv', 'm4v', 'mov', 'mp4', 'mpeg', 'mpg', 'wbm', 'wmv'].forEach((ext) => createFileType(ext, 'video'));
['7z', 'gz', 'rar', 'zip', 'zipx'].forEach((ext) => createFileType(ext, 'zip'));
['doc', 'docx'].forEach((ext) => createFileType(ext, 'word'));
['xls', 'xlsx'].forEach((ext) => createFileType(ext, 'xls'));
['ppt', 'pptx'].forEach((ext) => createFileType(ext, 'ppt'));

function getFileIconType(ext) {
    return fileIconType[ext] ? fileIconType[ext] : 'other';
}

const IMAGE_EXTS = { png: true, jpg: true, jpeg: true, bmp: true, gif: true };

function isImage(ext) {
    return !!IMAGE_EXTS[ext.toLowerCase().trim()];
}

module.exports = { getFileName, getFileExtension, getFileNameWithoutExtension, getFileIconType, isImage };
