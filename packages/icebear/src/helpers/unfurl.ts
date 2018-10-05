/**
 * All kinds of unfurl helpers
 */

const urlRegex: RegExp = require('url-regex')();
import config from '../config';

type HeaderDict = { [headerName: string]: string };
// url : headers
export const urlCache: { [url: string]: HeaderDict } = {};
// url : promise
const urlsInProgress: { [url: string]: Promise<HeaderDict> } = {};

/**
 * Detects urls in a string and returns them.
 * @param str - string containing zero or more urls
 */
export function getUrls(str: string): string[] {
    if (!str) return [];
    return str.match(urlRegex) || [];
}
export function getContentHeaders(url: string) {
    if (urlCache[url]) return Promise.resolve(urlCache[url]);
    if (urlsInProgress[url]) return urlsInProgress[url];

    const promise = new Promise<HeaderDict>((resolve, reject) => {
        const req = new XMLHttpRequest();
        let resolved = false;
        req.onreadystatechange = () => {
            switch (req.readyState) {
                case 1:
                    req.send();
                    break;
                case 2: {
                    resolved = true;
                    const res = parseResponseHeaders(req.getAllResponseHeaders());
                    req.abort();
                    urlCache[url] = res;
                    resolve(res);
                    break;
                }
                case 4:
                    // in case we got to DONE(4) without receiving headers
                    if (!resolved) reject(new Error(`${url} request failed`));
                    break;
                default:
                    break;
            }
        };
        req.timeout = config.unfurlTimeout;
        req.open('GET', url);
    }).finally(() => delete urlsInProgress[url]);

    urlsInProgress[url] = promise;
    return promise;
}

function parseResponseHeaders(headerStr: string): { [key: string]: string } {
    const headers = {};
    if (!headerStr) {
        return headers;
    }
    const headerPairs = headerStr.split('\u000d\u000a');
    for (let i = 0; i < headerPairs.length; i++) {
        const headerPair = headerPairs[i];
        // Can't use split() here because it does the wrong thing
        // if  header value has ": " in it.
        const index = headerPair.indexOf(': ');
        if (index > 0) {
            const key = headerPair.substring(0, index).toLowerCase();
            const val = headerPair.substring(index + 2);
            headers[key] = val;
        }
    }
    return headers;
}
