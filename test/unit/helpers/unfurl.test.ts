import fetchHeadersNode from '~/helpers/node-fetch-headers';

const URL = 'https://www.peerio.com';

describe('Unfurl', () => {
    it('fetchHeadersNode', async () => {
        const headers = await fetchHeadersNode(URL, 30000);
        headers.should.have.property('content-type');
    });
});
