import * as parse5 from 'parse5';

export interface HTMLParseResult {
    siteName: string;
    title?: string;
    description?: string;
    imageURL?: string;
    imageAlt?: string;
    faviconURL?: string;
}

export function parseHTML(url: string, data: string): HTMLParseResult | null {
    try {
        const doc = parse5.parse(data) as any; // parse5 typing isn't good
        if (!doc || !doc.childNodes) {
            console.error(`Failed to parse HTML from ${url}, got empty document`);
            return null;
        }

        const res = {} as HTMLParseResult;

        // Find head.
        let html = doc.childNodes.find(n => n.nodeName === 'html');
        if (!html || !html.childNodes) html = doc; // some pages don't bother with <html> tags
        let head = html.childNodes.find(n => n.nodeName === 'head');
        if (!head) head = html; // some pages don't even bother with <head>

        if (!head.childNodes) return null;

        head.childNodes.forEach(node => {
            switch (node.nodeName) {
                case 'title': {
                    if (res.title) break; // only use <title> tag if we didn't read it from opengraph.
                    if (!node.childNodes) break;
                    const titleNode = node.childNodes.find(n => n.nodeName === '#text') as any;
                    if (titleNode && typeof titleNode.value === 'string') {
                        res.title = titleNode.value.trim();
                    }
                    break;
                }
                case 'meta': {
                    if (!node.attrs) break;
                    const attrs = mapAttrs(node.attrs);
                    const content = attrs['content'];
                    switch (attrs['name']) {
                        case 'description':
                            if (!res.description) res.description = content; // prefer twitter or og description
                            break;
                        case 'twitter:title':
                            if (content) res.title = content;
                            break;
                        case 'twitter:image:src':
                            if (!res.imageURL) res.imageURL = content; // prefer og image
                            break;
                        case 'twitter:image:alt':
                            if (!res.imageAlt) res.imageAlt = content;
                            break;
                        default:
                            break;
                    }
                    switch (attrs['property']) {
                        case 'og:description':
                            if (content) res.description = content;
                            break;
                        case 'og:site_name':
                            if (content) res.siteName = content;
                            break;
                        case 'og:title':
                            if (content) res.title = content;
                            break;
                        case 'og:image':
                            if (content) res.imageURL = content;
                            break;
                        case 'og:image:url':
                            if (!res.imageURL) res.imageURL = content;
                            break;
                        case 'og:image:secure_url':
                            if (content) res.imageURL = content;
                            break;
                        case 'og:image:alt':
                            if (content) res.imageAlt = content;
                            break;
                        default:
                            break;
                    }
                    break;
                }
                case 'link': {
                    if (!node.attrs) break;
                    if (res.faviconURL) break; // first favicon is fine
                    const attrs = mapAttrs(node.attrs);
                    if (attrs['rel'] === 'shortcut icon' || attrs['rel'] === 'icon') {
                        res.faviconURL = attrs['href'];
                    }
                    break;
                }
                default:
                    break;
            }
        });

        // Validate and trim strings.
        res.siteName = trimOrUndefined(res.siteName);
        res.title = trimOrUndefined(res.title);
        res.description = trimOrUndefined(res.description);
        res.imageURL = trimOrUndefined(res.imageURL);
        res.faviconURL = trimOrUndefined(res.faviconURL);

        if (!res.siteName || res.siteName === res.title) {
            res.siteName = new URL(url).hostname.toLowerCase();
        }

        // Validate and resolve URLs.
        try {
            if (res.imageURL) res.imageURL = new URL(res.imageURL, url).href;
        } catch (err) {
            res.imageURL = undefined;
        }

        try {
            if (res.faviconURL) res.faviconURL = new URL(res.faviconURL, url).href;
        } catch (err) {
            res.faviconURL = undefined;
        }

        return res;
    } catch (err) {
        console.error(`Failed to parse HTML from ${url}`, err);
        return null;
    }
}

function trimOrUndefined(s: any): string | undefined {
    if (typeof s === 'string') return s.trim();
    return undefined;
}

function mapAttrs(arr: { name: string; value: string }[]): { [name: string]: string } {
    const map = {};
    arr.forEach(a => {
        map[a.name] = a.value;
    });
    return map;
}
