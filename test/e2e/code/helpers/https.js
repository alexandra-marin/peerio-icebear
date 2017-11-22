const https = require('https');

function getUrl(url) {
    console.log('Requesting url', url);
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const { statusCode } = res;
            let error;
            if (statusCode !== 200) {
                error = new Error(`${url} request fail. Status Code: ${statusCode}`);
            }
            if (error) {
                console.error(error.message);
                res.resume();
                reject(error);
                return;
            }
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                resolve(rawData);
            });
        }).on('error', (e) => {
            console.error(e);
            reject(e);
        });
    });
}

module.exports = { getUrl };
