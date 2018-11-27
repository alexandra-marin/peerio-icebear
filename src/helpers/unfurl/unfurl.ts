/**
 * All kinds of unfurl helpers
 */

import { when } from 'mobx';
import * as urlParser from 'url';
import socket from '../../network/socket';
import config from '../../config';
import clientApp from '../../models/client-app';
import TaskQueue from '../task-queue';
import CacheEngineBase from '../../db/cache-engine-base';
import { ExternalContent, ExternalWebsite, ExternalImage } from './types';
import { parseHTML } from './parse';
import { truncateWithEllipsis } from '../string';
const urlRegex: RegExp = require('url-regex')();

const urlsInProgress: { [url: string]: Promise<ExternalContent | null> } = {};
const queue = new TaskQueue(5);
let urlCache: CacheEngineBase<ExternalContent> | undefined;

export const htmlContentTypes = {
    'text/html': true,
    'application/xhtml+xml': true
};

/**
 * Detects urls in a string and returns them.
 * @param str - string containing zero or more urls
 */
export function getUrls(str: string): string[] {
    if (!str) return [];
    return str.match(urlRegex) || [];
}

interface FetchedContent {
    responseURL: string;
    contentType: string;
    contentLength: number;
    contentText?: string; // may be partial
}

export async function processUrl(url: string): Promise<ExternalContent | null> {
    if (!urlCache) {
        urlCache = new config.CacheEngine('unfurl', 'url');
    }
    if (!urlCache.isOpen) {
        await urlCache.open();
    }

    const cached = await urlCache.getValue(url);
    if (cached) return cached;

    return queue.addTask<ExternalContent | null>(async () => {
        try {
            const content = await getExternalContent(url);
            if (!content) return null;
            await urlCache.setValue(url, content);
            return content;
        } catch (err) {
            console.error(err);
            // There's no reliable way to know if XMLHttpRequest has failed due to disconnection,
            // so we use our socket connection as an indicator of being offline.
            // Also, socket.connected is usually updated with a little delay,
            // so we rely on this hacky way to postpone the connection check.
            // We wait for socket to disconnect and will assume our headers request failed
            // due to disconnection if socket disconnects within next few seconds.
            // False positives are possible but harmless.
            return new Promise((resolve, reject) => {
                let resolved = false;
                const dispose = when(
                    () => !socket.connected,
                    () => {
                        if (!queue.paused) {
                            when(() => socket.connected, () => queue.resume());
                            queue.pause();
                        }
                        resolved = true;
                        resolve(processUrl(url));
                    }
                );
                setTimeout(() => {
                    if (!resolved) {
                        dispose();
                        reject(new Error(`Failed to process URL ${url}`));
                    }
                }, 2000);
            });
        }
    });
}

export async function getExternalContent(
    url: string,
    expectImage = false
): Promise<ExternalContent | null> {
    if (!url.toLowerCase().startsWith('https://')) {
        // Insecure URL, don't try to fetch it.
        if (/\.(jpg|jpeg|gif|png|bmp)$/.test(url)) {
            // Probably an image, add it as insecure.
            return {
                type: 'image',
                url,
                length: 0,
                isOverInlineSizeLimit: false,
                isOversizeCutoff: false,
                isInsecure: true
            };
        }
    }

    if (urlsInProgress[url]) return urlsInProgress[url];

    const promise = fetchContent(url).then(async fetched => {
        if (!fetched) return null;

        if (config.chat.allowedInlineImageTypes[fetched.contentType]) {
            // Image.
            const image: ExternalImage = {
                type: 'image',
                url,
                length: fetched.contentLength,
                isOverInlineSizeLimit:
                    clientApp.uiUserPrefs.limitInlineImageSize &&
                    fetched.contentLength > config.chat.inlineImageSizeLimit,
                isOversizeCutoff: fetched.contentLength > config.chat.inlineImageSizeLimitCutoff,
                isInsecure: false
            };
            return image;
        }

        if (expectImage) return null;

        if (htmlContentTypes[fetched.contentType]) {
            if (!fetched.contentText) return null;
            const html = parseHTML(fetched.responseURL, fetched.contentText);
            if (!html) return null;
            const website: ExternalWebsite = {
                type: 'html',
                url,
                siteName: truncate(html.siteName, config.unfurl.maxSiteNameLength),
                title: truncate(html.title, config.unfurl.maxTitleLength),
                description: truncate(html.description, config.unfurl.maxDescriptionLength)
            };

            if (!html.faviconURL) {
                html.faviconURL = urlParser.resolve(fetched.responseURL, '/favicon.ico');
            }

            const favicon = await getExternalContent(html.faviconURL, true);
            if (favicon && favicon.type === 'image' && !favicon.isInsecure) {
                website.favicon = favicon;
            }

            if (html.imageURL) {
                const image = await getExternalContent(html.imageURL, true);
                if (image && image.type === 'image' && !image.isInsecure) {
                    website.image = image;
                    website.imageAlt = truncate(html.imageAlt, config.unfurl.maxImageAltLength);
                }
            }

            return website;
        }
        return null;
    });

    urlsInProgress[url] = promise;

    return promise.finally(() => {
        delete urlsInProgress[url];
    });
}

function fetchContent(url: string): Promise<FetchedContent | null> {
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        let resolved = false;
        const resp = {} as FetchedContent;

        req.onreadystatechange = () => {
            switch (req.readyState) {
                case 1 /* OPENED */:
                    req.send();
                    break;

                case 2 /* HEADERS_RECEIVED */: {
                    // Ensure we weren't redirected to insecure URL.
                    if (req.responseURL && !req.responseURL.toLowerCase().startsWith('https://')) {
                        resolved = true;
                        req.abort();
                        resolve(null);
                    }
                    // Remember response URL (which may be different from url if redirected)
                    // for resolving URLs after parsing.
                    resp.responseURL = req.responseURL || url;

                    const headers = parseResponseHeaders(req.getAllResponseHeaders());
                    resp.contentType = parseContentType(headers['content-type']);
                    resp.contentLength = parseContentLength(headers['content-length']);
                    // Image? Don't fetch content.
                    if (resp.contentType && config.chat.allowedInlineImageTypes[resp.contentType]) {
                        resolved = true;
                        req.abort();
                        resolve(resp);
                        return;
                    }
                    // Not HTML/XHTML? Stop.
                    if (!htmlContentTypes[resp.contentType]) {
                        resolved = true;
                        req.abort();
                        resolve(null);
                        return;
                    }
                    break;
                }

                case 3 /* LOADING */:
                    if (
                        req.responseText &&
                        req.responseText.length > config.unfurl.maxHTMLContentLength
                    ) {
                        // We got enough HTML content to extract info.
                        resolved = true;
                        resp.contentText = req.responseText;
                        req.abort();
                        resolve(resp);
                    }
                    break;

                case 4 /* DONE */:
                    if (resolved) {
                        return;
                    }
                    if (!resp.contentType) {
                        reject(new Error(`${url} request failed`));
                        return;
                    }
                    resp.contentText = req.responseText;
                    req.abort();
                    resolve(resp);
                    break;

                default:
                    break;
            }
        };
        req.timeout = config.unfurl.timeout;
        req.responseType = 'text';
        req.open('GET', url);
    });
}

function parseContentType(headerValue: string | null): string {
    if (!headerValue) return '';
    return headerValue.split(';')[0] || '';
}

function parseContentLength(headerValue: string | null): number {
    return +(headerValue || 0); // careful, +undefined is NaN
}

// XXX: This method is used because react-native 0.55 doesn't have
// a working xhr.getResponseHeader(). Fixed in 0.58.
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

function truncate(s: string | undefined, maxChars: number): string | undefined {
    if (typeof s === 'undefined') return undefined;
    return truncateWithEllipsis(s, maxChars);
}
