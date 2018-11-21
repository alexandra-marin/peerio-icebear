import * as parse5 from 'parse5';

export interface HTMLParseResult {
    siteName: string;
    title?: string;
    description?: string;
    imageURL?: string;
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
        if (!head) head = html; // some pages don't even bother with <head>. XXX: should we require it?

        if (!head.childNodes) return null;

        // TODO: find charset.
        head.childNodes.forEach(node => {
            const n = node;
            switch (node.nodeName) {
                case 'title': {
                    if (res.title) break; // only use <title> tag if we didn't read it from opengraph.
                    if (!n.childNodes) break;
                    const titleNode = n.childNodes.find(n => n.nodeName === '#text') as any;
                    if (titleNode && typeof titleNode.value === 'string')
                        res.title = titleNode.value.trim();
                    break;
                }
                case 'meta': {
                    if (!n.attrs) break;
                    const attrs = mapAttrs(n.attrs);
                    if (attrs['name'] == 'description' && !res.description) {
                        res.description = attrs['content'];
                    }
                    switch (attrs['property']) {
                        case 'og:description':
                            res.description = attrs['content'];
                            break;
                        case 'og:site_name':
                            res.siteName = attrs['content'];
                            break;
                        case 'og:title':
                            res.title = attrs['content'];
                            break;
                        case 'og:image':
                            res.imageURL = attrs['content'];
                            break;
                    }
                    break;
                }
                case 'link':
                    if (!n.attrs) break;
                    const attrs = mapAttrs(n.attrs);
                    if (attrs['rel'] === 'shortcut icon' || attrs['rel'] === 'icon') {
                        res.faviconURL = attrs['href'];
                    }
                    break;
            }
        });

        // Validate and trim strings.
        res.siteName = trimOrUndefined(res.title);
        res.title = trimOrUndefined(res.title);
        res.description = trimOrUndefined(res.description);
        res.imageURL = trimOrUndefined(res.imageURL);
        res.faviconURL = trimOrUndefined(res.faviconURL);

        if (!res.siteName) {
            res.siteName = new URL(url).hostname.toLowerCase();
        }

        // Validate URLs.
        try {
            new URL(res.imageURL);
        } catch (err) {
            res.imageURL = undefined;
        }

        try {
            new URL(res.faviconURL);
        } catch (err) {
            res.faviconURL = undefined;
        }

        console.log(res); // XXX: debug logging
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
