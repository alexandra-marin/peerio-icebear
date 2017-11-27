const https = require('https');
const request = require('request');
/**
 * Makes a GET request, returns a result in a promise.
 * @param {string} url
 * @returns {Promise<string>}
 */
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

function deleteRequest(url) {
    console.log('Sending delete request', url);
    return new Promise((resolve, reject) => {
        request.del(url, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { getUrl, deleteRequest };
