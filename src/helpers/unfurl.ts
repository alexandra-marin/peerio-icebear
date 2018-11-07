/**
 * All kinds of unfurl helpers
 */

const urlRegex: RegExp = require('url-regex')();
import config from '../config';

export type HeaderDict = { [headerName: string]: string };
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

export async function getContentHeaders(url: string): Promise<HeaderDict> {
    if (!url.toLowerCase().startsWith('https://')) {
        return Promise.reject(new Error('Trying to get headers from insecure URL'));
    }
    if (urlCache[url]) return Promise.resolve(urlCache[url]);
    if (urlsInProgress[url]) return urlsInProgress[url];

    const promise = config.unfurlHeadersFetcher()(url, config.unfurlTimeout);

    urlsInProgress[url] = promise;

    return promise.finally(() => {
        delete urlsInProgress[url];
    });
}
