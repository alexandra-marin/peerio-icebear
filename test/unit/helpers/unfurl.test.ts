import { getContentHeaders, getContentHeadersNode, getContentHeadersXHR } from '~/helpers/unfurl';

const URL = 'https://www.peerio.com';

describe('Unfurl', () => {
    it('getContentHeaders', async () => {
        const headers = await getContentHeaders(URL);
        headers.should.have.property('content-type');
    });

    it('getContentHeadersNode', async () => {
        const headers = await getContentHeadersNode(URL);
        headers.should.have.property('content-type');
    });

    it('getContentHeadersXHR', async () => {
        const headers = await getContentHeadersXHR(URL);
        headers.should.have.property('content-type');
    });
});
