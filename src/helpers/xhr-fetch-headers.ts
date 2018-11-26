export default function fetchHeaders(
    url: string,
    timeout: number
): Promise<{ [headerName: string]: string }> {
    return new Promise((resolve, reject) => {
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
        req.timeout = timeout;
        req.open('GET', url);
    });
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
