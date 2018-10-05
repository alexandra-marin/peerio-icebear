import config from '~/config';

let url = './static/img/illustration-zero-files.svg';
if (config.whiteLabel.name === 'medcryptor') {
    url = './static/whitelabel/img/illustration-zero-files.svg';
}

export const zeroFilesIllustrationUrl = url;
