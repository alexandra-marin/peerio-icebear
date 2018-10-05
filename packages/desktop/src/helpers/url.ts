import { matcher } from 'autolinker';
const { Url: UrlMatcher, Email: EmailMatcher } = matcher as any; // bad typings

const allowedProtocols = ['HTTP://', 'HTTPS://', 'MAILTO:'];

export function isUrlAllowed(url: string): boolean {
    if (typeof url !== 'string') return false;
    const URL = url.toLocaleUpperCase().trim();
    for (let i = 0; i < allowedProtocols.length; i++) {
        if (URL.startsWith(allowedProtocols[i])) return true;
    }
    return false;
}

/* After some discussion, it was decided to use Autolinker's url matching logic
 * because it was the most robust I could find. It correctly handles a lot of
 * edge cases, like including/excluding the closing parentheses at the end of a
 * message when it should/shouldn't be part of the url.
 * eg. "hey, check the new blog page (peerio.com/blog)" should exclude the paren,
 * but "en.wikipedia.org/wiki/Devo_(disambiguation)" should include it!
 *
 * It's not super-modular so we have to grab it from the main import -- and it's
 * not clear to what degree it's an internal API, so it might change from under
 * us. Might be worth opening an issue on the Autolinker repo about modularizing
 * it.
 */
const urlMatcher = new UrlMatcher({
    tagBuilder: {}, // We can pass a dummy tagBuilder as long as we're not actually generating <a> tags
    stripPrefix: false,
    stripTrailingSlash: false
});
const emailMatcher = new EmailMatcher({ tagBuilder: {} });

/**
 * @param text The string to search for URL matches.
 */
export function parseUrls(
    text: string
): { text: string; index: number; href: string }[] {
    return urlMatcher
        .parseMatches(text)
        .concat(emailMatcher.parseMatches(text))
        .map(match => ({
            text: match.matchedText,
            index: match.offset,
            href: match.getAnchorHref()
        }))
        .filter(match => isUrlAllowed(match.href));
}
