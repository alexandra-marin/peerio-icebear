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

export const getContentHeaders = config.isMobile ? getContentHeadersXHR : getContentHeadersNode;

let https; // Node module 'https', loaded when not on mobile.

// Exported for unit testing, use getContentHeaders.
export function getContentHeadersNode(url: string): Promise<HeaderDict> {
    if (!https) https = require('https'); // eslint-disable-line global-require
    if (urlCache[url]) return Promise.resolve(urlCache[url]);
    if (urlsInProgress[url]) return urlsInProgress[url];
    const promise = new Promise<HeaderDict>((resolve, reject) => {
        https
            .get(url, response => {
                const res = response.headers;
                urlCache[url] = res;
                response.resume();
                resolve(res);
            })
            .on('error', reject);
    }).finally(() => delete urlsInProgress[url]);
    urlsInProgress[url] = promise;
    return promise;
}

// Exported for unit testing, use getContentHeaders.
export function getContentHeadersXHR(url: string): Promise<HeaderDict> {
    if (!url.toLowerCase().startsWith('https://')) {
        return Promise.reject(new Error('Trying to get headers from insecure URL'));
    }
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
