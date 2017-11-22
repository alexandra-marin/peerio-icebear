/*
    maildrop.cc api helper

    API is very simple

    1. Get inbox (no body) newest first

        GET https://maildrop.cc/api/inbox/:name
        Response:
        [
            {
                "id": "string",
                "sender": "string",
                "subject": "string",
                "date": "Nov 19 2017 08:00 PM"
            },
            ...
        ]

    2. Get email:

        GET https://maildrop.cc/api/inbox/:name/:id
        Response:
        {
            "id": "string",
            "sender": "string",
            "recipient": "string",
            "subject": "string",
            "date": 1511117201000,
            "body": "string"
        }
 */

const https = require('https');

// fetches json response from maildrop GET api url
function requestMaildropAPI(url) {
    console.log('Requesting url', url);
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            console.log('Got response to', url);
            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            let error;
            if (statusCode !== 200) {
                error = new Error(`maildrop: request fail. Status Code: ${statusCode}`);
            } else if (!contentType.startsWith('application/json')) {
                error = new Error('maildrop: invalid content-type.\n' +
                    `Expected application/json but received ${contentType}`);
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
                try {
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData);
                } catch (e) {
                    console.error(e);
                    reject(e);
                }
            });
        }).on('error', (e) => {
            console.error(e);
            reject(e);
        });
    });
}

// retrieves inbox json
function getInbox(name) {
    console.log(`maildrop: requesting inbox ${name}`);
    return requestMaildropAPI(`https://maildrop.cc/api/inbox/${name}`);
}

// retrieves email json
function getEmail(name, id) {
    console.log(`maildrop: requesting email ${id} in inbox ${name}`);
    return requestMaildropAPI(`https://maildrop.cc/api/inbox/${name}/${id}`);
}

// retrieves latest email id with specified subject or null
// todo: timestamp to search emails after it
function findEmailWithSubject(name, subject) {
    return getInbox(name).then(inbox => {
        for (let i = 0; i < inbox.length; i++) {
            if (inbox[i].subject === subject) return inbox[i].id;
        }
        return null;
    });
}

/**
 * Makes several attempts to retrieve an email with specific subject during set timeout
 * @param {string} name - mailbox name
 * @param {string} subject
 * @param {number} [timeout=15000]
 */
function waitForEmail(name, subject, timeout = 25000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        function makeAttempt() {
            console.log(`Attempting to find an email with subject: '${subject}' in mailbox '${name}'`);
            findEmailWithSubject(name, subject)
                .then((id) => {
                    if (id) return getEmail(name, id).then(resolve);
                    if (Date.now() - start > timeout) {
                        console.log('Email not arrived. Giving up.');
                        reject();
                    } else {
                        console.log('Email not arrived yet, waiting.');
                        setTimeout(makeAttempt, 2000);
                    }
                    return null;
                })
                .catch(reject);
        }
        makeAttempt();
    });
}

module.exports = { waitForEmail };
