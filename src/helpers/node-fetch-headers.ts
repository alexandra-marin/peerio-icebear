import * as https from 'https';

export default function fetchHeaders(
    url: string,
    timeout: number
): Promise<{ [headerName: string]: string }> {
    let rejected = false;
    return new Promise((resolve, reject) => {
        const request = https
            .get(url, response => {
                const res = response.headers;
                response.resume();
                for (const key in res) {
                    const val = res[key];
                    // If there are two headers with the same name,
                    // leave only the first one.
                    //
                    // We don't need multiple headers for now, but if we do
                    // in the future, remove this filtering and change
                    // return type.
                    if (Array.isArray(val)) {
                        res[key] = val.length === 0 ? '' : val[0];
                    }
                    // Just convert the rest to empty strings.
                    if (typeof val !== 'string') {
                        res[key] = '';
                    }
                }
                resolve(res as { [headerName: string]: string });
            })
            .on('error', err => {
                if (!rejected) {
                    rejected = true;
                    reject(err);
                }
            });

        request.setTimeout(timeout, () => {
            request.abort();
            if (!rejected) {
                reject(new Error('Timeout when fetching headers'));
                rejected = true; // since 'error' may be called
            }
        });
    });
}
